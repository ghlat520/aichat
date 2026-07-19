package com.aichat.kernel.identity;

import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.time.Clock;

@Component
public final class UlidGenerator {
    private static final char[] CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();

    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public UlidGenerator(Clock clock) {
        this.clock = clock;
    }

    public String next() {
        byte[] value = new byte[16];
        long timestamp = clock.millis();
        for (int index = 5; index >= 0; index--) {
            value[index] = (byte) timestamp;
            timestamp >>>= 8;
        }
        byte[] entropy = new byte[10];
        random.nextBytes(entropy);
        System.arraycopy(entropy, 0, value, 6, entropy.length);

        BigInteger encoded = new BigInteger(1, value);
        char[] result = new char[26];
        for (int index = result.length - 1; index >= 0; index--) {
            result[index] = CROCKFORD[encoded.and(BigInteger.valueOf(31)).intValue()];
            encoded = encoded.shiftRight(5);
        }
        return new String(result);
    }
}
