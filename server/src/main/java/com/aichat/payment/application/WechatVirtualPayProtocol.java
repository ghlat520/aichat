package com.aichat.payment.application;

import com.aichat.kernel.api.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;

import javax.crypto.Mac;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

/** Exact-byte signatures and WeChat message-push framing, separate from ordinary APIv3 payment. */
public final class WechatVirtualPayProtocol {
    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    private WechatVirtualPayProtocol() { }

    public static Map<String, Object> signPayment(String signData, String appKey, String sessionKey) {
        return Map.of(
                "mode", "short_series_goods",
                "signData", signData,
                "paySig", hmac(appKey, "requestVirtualPayment&" + signData),
                "signature", hmac(sessionKey, signData)
        );
    }

    public static String hmac(String key, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("虚拟支付签名不可用", exception);
        }
    }

    public static String verifyEcho(String echo, PushQuery query, PushConfig config) {
        if (query.messageSignature() != null && !query.messageSignature().isBlank()) {
            verifySignature(query.messageSignature(), config.token(), query.timestamp(), query.nonce(), echo);
            return decrypt(echo, config);
        }
        verifySignature(query.signature(), config.token(), query.timestamp(), query.nonce());
        return echo;
    }

    public static JsonNode decodePush(byte[] body, PushQuery query, PushConfig config) {
        if (body == null || body.length == 0 || body.length > 65536) throw invalidPush();
        JsonNode envelope = parseMessage(new String(body, StandardCharsets.UTF_8));
        if (envelope.has("Encrypt")) {
            String encrypted = envelope.path("Encrypt").asText();
            verifySignature(query.messageSignature(), config.token(), query.timestamp(), query.nonce(), encrypted);
            return parseMessage(decrypt(encrypted, config));
        }
        if ((config.encodingAesKey() != null && !config.encodingAesKey().isBlank()) || "aes".equals(query.encryptType())) {
            throw invalidPush();
        }
        verifySignature(query.signature(), config.token(), query.timestamp(), query.nonce());
        return envelope;
    }

    private static String decrypt(String encrypted, PushConfig config) {
        try {
            byte[] key = Base64.getDecoder().decode(config.encodingAesKey() + "=");
            if (key.length != 32) throw invalidPush();
            Cipher cipher = Cipher.getInstance("AES/CBC/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(Arrays.copyOf(key, 16)));
            byte[] padded = cipher.doFinal(Base64.getDecoder().decode(encrypted));
            if (padded.length == 0 || padded.length % 32 != 0) throw invalidPush();
            int padding = Byte.toUnsignedInt(padded[padded.length - 1]);
            if (padding < 1 || padding > 32) throw invalidPush();
            for (int i = padded.length - padding; i < padded.length; i++) if (Byte.toUnsignedInt(padded[i]) != padding) throw invalidPush();
            int end = padded.length - padding;
            if (end < 20) throw invalidPush();
            int length = ByteBuffer.wrap(padded, 16, 4).getInt();
            if (length < 0 || length > end - 20) throw invalidPush();
            byte[] actualApp = Arrays.copyOfRange(padded, 20 + length, end);
            if (!MessageDigest.isEqual(actualApp, config.appId().getBytes(StandardCharsets.UTF_8))) throw invalidPush();
            return new String(padded, 20, length, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException | NullPointerException exception) {
            throw invalidPush();
        }
    }

    private static void verifySignature(String supplied, String... values) {
        if (supplied == null || !supplied.matches("[a-fA-F0-9]{40}")
                || Arrays.stream(values).anyMatch(value -> value == null || value.isEmpty())) throw invalidPush();
        try {
            String[] sorted = values.clone();
            Arrays.sort(sorted);
            byte[] actual = MessageDigest.getInstance("SHA-1")
                    .digest(String.join("", sorted).getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(actual, HexFormat.of().parseHex(supplied))) throw invalidPush();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("消息签名不可用", exception);
        }
    }

    private static JsonNode parseMessage(String text) {
        try {
            if (text.stripLeading().startsWith("{")) {
                JsonNode value = JSON.readTree(text);
                if (!value.isObject()) throw invalidPush();
                return value;
            }
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            var builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
                @Override public void fatalError(org.xml.sax.SAXParseException error) throws org.xml.sax.SAXException { throw error; }
            });
            Element root = builder.parse(new InputSource(new StringReader(text))).getDocumentElement();
            if (!"xml".equals(root.getTagName())) throw invalidPush();
            return element(root, 0);
        } catch (ApiException exception) {
            throw exception;
        } catch (javax.xml.parsers.ParserConfigurationException | org.xml.sax.SAXException | java.io.IOException exception) {
            throw invalidPush();
        }
    }

    private static JsonNode element(Element element, int depth) {
        if (depth > 8) throw invalidPush();
        ObjectNode result = JSON.createObjectNode();
        boolean children = false;
        for (Node node = element.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element child) {
                children = true;
                if (result.has(child.getTagName())) throw invalidPush();
                result.set(child.getTagName(), element(child, depth + 1));
            }
        }
        return children ? result : JSON.getNodeFactory().textNode(element.getTextContent());
    }

    private static ApiException invalidPush() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "WECHAT_PUSH_INVALID", "微信支付消息校验失败");
    }

    public record PushConfig(String token, String encodingAesKey, String appId) { }
    public record PushQuery(String signature, String messageSignature, String timestamp, String nonce, String encryptType) { }
}
