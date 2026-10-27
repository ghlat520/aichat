package com.aichat.payment;

import com.aichat.payment.application.WechatVirtualPayProtocol;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WechatVirtualPayProtocolTest {
    private static final String AES_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";
    // Fixed fixture encrypted independently with OpenSSL, using WeChat's 32-byte PKCS7 framing.
    private static final String CIPHER = "fb2IJy+yWTdpKjuBAEdBdfzVs0QmhFI5uDS9oJw8cbCX8zYEZ4svTppkQuz0zfJGopPxb/ZKrJkigdi8OYYZCcsXJ0J1JBUYN0J1z0EAlRufIcnAtj35iCdDrN2pBJ7QNFd5Nw0nQ30gExRZ0HS6okzwGYocLnsZNgm5F2bQTTLyy8R31SlE/6Qa1Accx3li11hZqJlw1Sl2CmjP0gkiOikUEC/pAUwV3e5xcrkZIQdobs/G/K18SV79HRBpWWr6";

    @Test
    void signsExactWireBytesWithTheLiteralAppAndSessionKeys() {
        String data = "{\"offerId\":\"1234567890\",\"buyQuantity\":1,\"env\":1,\"currencyType\":\"CNY\",\"productId\":\"report_unlock_v1\",\"goodsPrice\":990,\"outTradeNo\":\"TEST202610270001\",\"attach\":\"report_demo_001\"}";
        var payment = WechatVirtualPayProtocol.signPayment(
                data, "example_app_key_not_real", "example_session_key_not_real");
        assertThat(payment.get("signData")).isEqualTo(data);
        assertThat(payment.get("mode")).isEqualTo("short_series_goods");
        assertThat(payment.get("paySig")).isEqualTo("07afe44cac2533b6bedcbc215e099ae876c6dbd8f121c855b695e395ab719e58");
        assertThat(payment.get("signature")).isEqualTo("4189eb09903ee9648a581c443be52eca7460a6c5e2df727783909b5c18ace31b");
    }

    @Test
    void authenticatesThePushBeforeReturningAnyBusinessFields() {
        var config = new WechatVirtualPayProtocol.PushConfig("testPushToken", "", "wx0123456789abcdef");
        var query = new WechatVirtualPayProtocol.PushQuery("wrong-signature", null, "1793059200", "nonce01", null);
        byte[] xml = "<xml><Event>xpay_goods_deliver_notify</Event><OutTradeNo>ORDER202610270001</OutTradeNo></xml>".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        assertThatThrownBy(() -> WechatVirtualPayProtocol.decodePush(xml, query, config))
                .isInstanceOf(com.aichat.kernel.api.ApiException.class)
                .hasMessage("微信支付消息校验失败");
    }

    @Test
    void verifiesPlainUrlEchoAndParsesSignedXmlWithoutResolvingExternalEntities() {
        var config = new WechatVirtualPayProtocol.PushConfig("testPushToken", "", "wx0123456789abcdef");
        var query = new WechatVirtualPayProtocol.PushQuery("c273398808149132fed028d5ead54a3259ae87ef", null, "1793059200", "nonce01", null);
        assertThat(WechatVirtualPayProtocol.verifyEcho("echo-123", query, config)).isEqualTo("echo-123");
        assertThat(WechatVirtualPayProtocol.decodePush("<xml><Event>xpay_goods_deliver_notify</Event></xml>".getBytes(), query, config)
                .path("Event").asText()).isEqualTo("xpay_goods_deliver_notify");
        assertThatThrownBy(() -> WechatVirtualPayProtocol.decodePush(
                "<!DOCTYPE xml [<!ENTITY secret SYSTEM 'file:///etc/passwd'>]><xml><Event>&secret;</Event></xml>".getBytes(), query, config))
                .isInstanceOf(com.aichat.kernel.api.ApiException.class);
    }

    @Test
    void decryptsOnlyAppBoundAuthenticatedMessagesAndRejectsPlaintextDowngrade() {
        var config = new WechatVirtualPayProtocol.PushConfig("testPushToken", AES_KEY, "wx0123456789abcdef");
        var query = new WechatVirtualPayProtocol.PushQuery("c273398808149132fed028d5ead54a3259ae87ef", "70beff4ca7411526f1c8bb2694d8b44574e5b8ee", "1793059200", "nonce01", "aes");
        byte[] body = ("<xml><Encrypt>" + CIPHER + "</Encrypt></xml>").getBytes();
        assertThat(WechatVirtualPayProtocol.decodePush(body, query, config).path("OutTradeNo").asText())
                .isEqualTo("ORDER202610270001");
        var wrongApp = new WechatVirtualPayProtocol.PushConfig("testPushToken", AES_KEY, "wx1111111111111111");
        assertThatThrownBy(() -> WechatVirtualPayProtocol.decodePush(body, query, wrongApp))
                .isInstanceOf(com.aichat.kernel.api.ApiException.class);
        var badSignature = new WechatVirtualPayProtocol.PushQuery(query.signature(), "0000000000000000000000000000000000000000", query.timestamp(), query.nonce(), "aes");
        assertThatThrownBy(() -> WechatVirtualPayProtocol.decodePush(body, badSignature, config))
                .isInstanceOf(com.aichat.kernel.api.ApiException.class);
        assertThatThrownBy(() -> WechatVirtualPayProtocol.decodePush("<xml><Event>xpay_refund_notify</Event></xml>".getBytes(), query, config))
                .isInstanceOf(com.aichat.kernel.api.ApiException.class);
    }
}
