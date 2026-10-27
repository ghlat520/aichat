import WebSocket from 'ws';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeRoute(route) {
  return String(route || '').replace(/^\/+/, '').split('?')[0];
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 0;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (bytes) => {
      const message = JSON.parse(String(bytes));
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} 超时`));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || 'CDP Runtime.evaluate failed');
    }
    return response.result.value;
  }

  close() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
  }
}

export class CdpUi {
  constructor({ port = 9222, timeout = 12000 } = {}) {
    this.port = port;
    this.timeout = timeout;
  }

  async target(route) {
    const expected = `/__pageframe__/${normalizeRoute(route)}`;
    const deadline = Date.now() + this.timeout;
    let lastTargets = [];
    while (Date.now() < deadline) {
      const response = await fetch(`http://127.0.0.1:${this.port}/json/list`);
      if (!response.ok) throw new Error(`CDP target list HTTP ${response.status}`);
      lastTargets = await response.json();
      const target = lastTargets.find((item) => String(item.url || '').includes(expected));
      if (target && target.webSocketDebuggerUrl) return target;
      await sleep(120);
    }
    throw new Error(
      `等待 CDP pageframe ${expected} 超时；当前=${lastTargets.map((item) => item.url).filter(Boolean).join(', ')}`
    );
  }

  async mainTarget() {
    const response = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    if (!response.ok) throw new Error(`CDP target list HTTP ${response.status}`);
    const targets = await response.json();
    const target = targets.find(
      (item) => item.type === 'page' && String(item.url || '').includes('/html/index.html')
    );
    if (!target || !target.webSocketDebuggerUrl) throw new Error('未找到微信开发者工具主窗口 CDP target');
    return target;
  }

  async topRoute() {
    const target = await this.mainTarget();
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    try {
      const url = await client.evaluate(`(() => {
        const frames = Array.from(document.querySelectorAll('webview'))
          .map((element) => String(element.src || element.getAttribute('src') || ''))
          .filter((value) => value.includes('/__pageframe__/pages/'));
        return frames.length ? frames[frames.length - 1] : '';
      })()`);
      const marker = '/__pageframe__/';
      return String(url || '').includes(marker) ? String(url).split(marker)[1].split('?')[0] : '';
    } finally {
      client.close();
    }
  }

  async withClient(route, operation) {
    const target = await this.target(route);
    const client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    try {
      return await operation(client);
    } finally {
      client.close();
    }
  }

  async exists(route, selector) {
    return this.withClient(route, (client) =>
      client.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
    );
  }

  async evaluate(route, expression) {
    return this.withClient(route, (client) => client.evaluate(expression));
  }

  async text(route, selector) {
    return this.withClient(route, (client) =>
      client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        return element ? String(element.innerText || element.textContent || '').trim() : '';
      })()`)
    );
  }

  async count(route, selector) {
    return this.withClient(route, (client) =>
      client.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)
    );
  }

  async value(route, selector) {
    return this.withClient(route, (client) =>
      client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return undefined;
        const editable = element.matches('input, textarea') ? element : element.querySelector('input, textarea');
        return String((editable || element).value || '');
      })()`)
    );
  }

  async attribute(route, selector, name) {
    return this.withClient(route, (client) =>
      client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        return element ? element.getAttribute(${JSON.stringify(name)}) : null;
      })()`)
    );
  }

  async click(route, selector) {
    const expectedRoute = normalizeRoute(route);
    const topRoute = await this.topRoute();
    if (topRoute !== expectedRoute) {
      throw new Error(`拒绝点击非顶层页面：期望 ${expectedRoute}，实际 ${topRoute || 'none'}`);
    }
    return this.withClient(route, async (client) => {
      await client.evaluate(`new Promise((resolve, reject) => {
        try {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) throw new Error('missing selector: ${selector.replaceAll("'", "\\'")}');
          element.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) throw new Error('zero-size selector: ${selector.replaceAll("'", "\\'")}');

          const wxElement = element.__wxElement;
          const hasRenderedTap = Boolean(wxElement && wxElement.__wxEvents && wxElement.__wxEvents.tap);
          if (hasRenderedTap && typeof wxElement.triggerEvent === 'function') {
            wxElement.triggerEvent('tap', {}, { bubbles: true, composed: true });
            resolve(true);
            return;
          }

          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          const touch = new Touch({
            identifier: Date.now(),
            target: element,
            clientX: x,
            clientY: y,
            pageX: x + window.scrollX,
            pageY: y + window.scrollY
          });
          element.dispatchEvent(new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [touch],
            targetTouches: [touch],
            changedTouches: [touch]
          }));
          setTimeout(() => {
            element.dispatchEvent(new TouchEvent('touchend', {
              bubbles: true,
              cancelable: true,
              touches: [],
              targetTouches: [],
              changedTouches: [touch]
            }));
            resolve(true);
          }, 60);
        } catch (error) {
          reject(error);
        }
      })`);
    });
  }

  async input(route, selector, value) {
    return this.withClient(route, async (client) => {
      await client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) throw new Error('missing selector: ${selector.replaceAll("'", "\\'")}');
        element.scrollIntoView({ block: 'center', inline: 'center' });
        const editable = element.matches('input, textarea') ? element : element.querySelector('input, textarea');
        if (!editable) throw new Error('selector is not editable: ${selector.replaceAll("'", "\\'")}');
        editable.focus();
        if (typeof editable.select === 'function') editable.select();
        const inserted = document.execCommand('insertText', false, ${JSON.stringify(String(value))});
        if (!inserted) throw new Error('browser editing command rejected: ${selector.replaceAll("'", "\\'")}');
        return true;
      })()`);
    });
  }

  async scrollIntoView(route, selector) {
    return this.withClient(route, (client) =>
      client.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        return true;
      })()`)
    );
  }

  async screenshot(route) {
    return this.withClient(route, async (client) => {
      const dataUrl = await client.evaluate(`new Promise((resolve, reject) => {
        try {
          const width = Math.max(1, Math.ceil(document.documentElement.scrollWidth || document.body.scrollWidth));
          const height = Math.max(1, Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight));
          let css = '';
          for (const sheet of Array.from(document.styleSheets || [])) {
            try {
              css += Array.from(sheet.cssRules || []).map((rule) => rule.cssText).join('\\n');
            } catch (_) {
            }
          }
          const bodyClone = document.body.cloneNode(true);
          for (const element of [bodyClone, ...Array.from(bodyClone.querySelectorAll('*'))]) {
            for (const attribute of Array.from(element.attributes || [])) {
              if (attribute.name.includes(':')) element.removeAttribute(attribute.name);
            }
          }
          for (const script of Array.from(bodyClone.querySelectorAll('script'))) script.remove();
          const body = new XMLSerializer().serializeToString(bodyClone);
          const escapedCss = css.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">'
            + '<foreignObject width="100%" height="100%">'
            + '<div xmlns="http://www.w3.org/1999/xhtml"><style>' + escapedCss + '</style>' + body + '</div>'
            + '</foreignObject></svg>';
          const image = new Image();
          image.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const context = canvas.getContext('2d');
              context.fillStyle = '#f4f6fb';
              context.fillRect(0, 0, width, height);
              context.drawImage(image, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (error) {
              reject(error);
            }
          };
          image.onerror = () => reject(new Error('DOM screenshot image decode failed'));
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        } catch (error) {
          reject(error);
        }
      })`);
      if (!String(dataUrl || '').startsWith('data:image/png;base64,')) {
        throw new Error('DOM screenshot did not return PNG data');
      }
      return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    });
  }
}
