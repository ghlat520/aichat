package com.aichat.kernel.content;

import com.aichat.kernel.content.EnvelopeEncryptionService.ContentCryptoException;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnvelopeEncryptionServiceTest {
    private static final String KEY = "ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=";

    @Test
    void eachContentVersionUsesFreshAuthenticatedCiphertext() {
        EnvelopeEncryptionService service = new EnvelopeEncryptionService(KEY, "test-v1");
        byte[] plaintext = "仅用于加密边界测试的已遮蔽内容".getBytes(StandardCharsets.UTF_8);

        EncryptedPayload first = service.encrypt("01TESTCONTENT0000000000001", plaintext);
        EncryptedPayload second = service.encrypt("01TESTCONTENT0000000000002", plaintext);

        assertThat(first.ciphertext()).isNotEqualTo(second.ciphertext());
        assertThat(first.wrappedDek()).isNotEqualTo(second.wrappedDek());
        assertThat(service.decrypt("01TESTCONTENT0000000000001", first)).isEqualTo(plaintext);
    }

    @Test
    void ciphertextAndMetadataTamperingFailClosed() {
        EnvelopeEncryptionService service = new EnvelopeEncryptionService(KEY, "test-v1");
        EncryptedPayload original = service.encrypt(
                "01TESTCONTENT0000000000003",
                "安全内容".getBytes(StandardCharsets.UTF_8)
        );
        byte[] changedCiphertext = original.ciphertext().clone();
        changedCiphertext[0] ^= 1;
        EncryptedPayload tampered = new EncryptedPayload(
                changedCiphertext,
                original.contentNonce(),
                original.wrappedDek(),
                original.wrapNonce(),
                original.keyVersion(),
                original.contentHash()
        );

        assertThatThrownBy(() -> service.decrypt("01TESTCONTENT0000000000003", tampered))
                .isInstanceOf(ContentCryptoException.class);
        assertThatThrownBy(() -> service.decrypt("01TESTCONTENT0000000000003", new EncryptedPayload(
                original.ciphertext(),
                original.contentNonce(),
                original.wrappedDek(),
                original.wrapNonce(),
                original.keyVersion(),
                "0".repeat(64)
        ))).isInstanceOf(ContentCryptoException.class);
    }

    @Test
    void invalidMasterKeyFailsAtStartupBoundary() {
        assertThatThrownBy(() -> new EnvelopeEncryptionService("bm90LTMyLWJ5dGVz", "test-v1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 字节");
    }
}
