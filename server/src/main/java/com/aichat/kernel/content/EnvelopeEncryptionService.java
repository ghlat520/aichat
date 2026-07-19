package com.aichat.kernel.content;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Encrypts every content version with a fresh DEK and wraps that DEK with the configured master key.
 * The GCM authentication tag is carried inside the ciphertext returned by the JCA provider.
 */
@Component
public final class EnvelopeEncryptionService {
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int NONCE_BYTES = 12;

    private final SecretKey masterKey;
    private final String keyVersion;
    private final SecureRandom random = new SecureRandom();

    public EnvelopeEncryptionService(
            @Value("${aichat.security.content-master-key}") String encodedMasterKey,
            @Value("${aichat.security.content-key-version}") String keyVersion
    ) {
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(encodedMasterKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("aichat.security.content-master-key 必须是 Base64", exception);
        }
        if (keyBytes.length != 32) {
            throw new IllegalStateException("aichat.security.content-master-key 解码后必须是 32 字节");
        }
        if (keyVersion == null || keyVersion.isBlank() || keyVersion.length() > 64) {
            throw new IllegalStateException("aichat.security.content-key-version 长度必须为 1–64");
        }
        this.masterKey = new SecretKeySpec(keyBytes, "AES");
        this.keyVersion = keyVersion;
    }

    public EncryptedPayload encrypt(String contentVersionId, byte[] plaintext) {
        try {
            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
            keyGenerator.init(256, random);
            SecretKey dek = keyGenerator.generateKey();
            byte[] contentNonce = nonce();
            byte[] wrapNonce = nonce();
            byte[] ciphertext = crypt(
                    Cipher.ENCRYPT_MODE,
                    dek,
                    contentNonce,
                    contentAad(contentVersionId),
                    plaintext
            );
            byte[] wrappedDek = crypt(
                    Cipher.ENCRYPT_MODE,
                    masterKey,
                    wrapNonce,
                    wrapAad(contentVersionId),
                    dek.getEncoded()
            );
            return new EncryptedPayload(
                    ciphertext,
                    contentNonce,
                    wrappedDek,
                    wrapNonce,
                    keyVersion,
                    digest(ciphertext, contentNonce, wrappedDek, wrapNonce, keyVersion.getBytes(StandardCharsets.UTF_8))
            );
        } catch (GeneralSecurityException exception) {
            throw new ContentCryptoException("内容加密失败", exception);
        }
    }

    public byte[] decrypt(String contentVersionId, EncryptedPayload payload) {
        if (!keyVersion.equals(payload.keyVersion())) {
            throw new ContentCryptoException("内容密钥版本不可用");
        }
        try {
            String actualHash = digest(
                    payload.ciphertext(),
                    payload.contentNonce(),
                    payload.wrappedDek(),
                    payload.wrapNonce(),
                    payload.keyVersion().getBytes(StandardCharsets.UTF_8)
            );
            if (!MessageDigest.isEqual(
                    actualHash.getBytes(StandardCharsets.US_ASCII),
                    payload.contentHash().getBytes(StandardCharsets.US_ASCII)
            )) {
                throw new ContentCryptoException("内容密文元数据完整性校验失败");
            }
            byte[] dekBytes = crypt(
                    Cipher.DECRYPT_MODE,
                    masterKey,
                    payload.wrapNonce(),
                    wrapAad(contentVersionId),
                    payload.wrappedDek()
            );
            SecretKey dek = new SecretKeySpec(dekBytes, "AES");
            return crypt(
                    Cipher.DECRYPT_MODE,
                    dek,
                    payload.contentNonce(),
                    contentAad(contentVersionId),
                    payload.ciphertext()
            );
        } catch (GeneralSecurityException exception) {
            throw new ContentCryptoException("内容解密或完整性校验失败", exception);
        }
    }

    private byte[] crypt(int mode, SecretKey key, byte[] nonce, byte[] aad, byte[] input)
            throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(mode, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
        cipher.updateAAD(aad);
        return cipher.doFinal(input);
    }

    private byte[] nonce() {
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        return nonce;
    }

    private byte[] contentAad(String contentVersionId) {
        return ("aichat:content:" + contentVersionId + ":" + keyVersion).getBytes(StandardCharsets.UTF_8);
    }

    private byte[] wrapAad(String contentVersionId) {
        return ("aichat:dek:" + contentVersionId + ":" + keyVersion).getBytes(StandardCharsets.UTF_8);
    }

    private String digest(byte[]... parts) throws GeneralSecurityException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (byte[] part : parts) digest.update(part);
        return HexFormat.of().formatHex(digest.digest());
    }

    public record EncryptedPayload(
            byte[] ciphertext,
            byte[] contentNonce,
            byte[] wrappedDek,
            byte[] wrapNonce,
            String keyVersion,
            String contentHash
    ) {
    }

    public static final class ContentCryptoException extends RuntimeException {
        public ContentCryptoException(String message) {
            super(message);
        }

        public ContentCryptoException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
