package com.aichat.payment;

import com.aichat.kernel.api.ApiException;
import com.aichat.payment.application.VirtualPaySettings;
import com.aichat.payment.application.VirtualPaymentMapper;
import com.aichat.report.application.GrowthReportPurchasePolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class VirtualPayConfigurationTest {
    @Test
    void paymentDefaultsOffAndOnlyIsolatedProfilesAllowLoopbackReplacement() {
        assertThatThrownBy(() -> new VirtualPaySettings(new MockEnvironment()).requireEnabled())
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.error().code()).isEqualTo("VIRTUAL_PAY_NOT_CONFIGURED"));
        var local = new MockEnvironment().withProperty("aichat.virtual-pay.api-base", "http://127.0.0.1:18888");
        assertThatThrownBy(() -> new VirtualPaySettings(local)).isInstanceOf(IllegalStateException.class);
        local.setActiveProfiles("virtual-pay-test");
        assertThat(new VirtualPaySettings(local).apiBase()).isEqualTo("http://127.0.0.1:18888");
        for (String url : new String[]{"https://api.weixin.qq.com.evil.test", "http://localhost:18888", "http://127.0.0.1:18888/redirect", "http://user@127.0.0.1:18888"}) {
            local.setProperty("aichat.virtual-pay.api-base", url);
            assertThatThrownBy(() -> new VirtualPaySettings(local)).isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    void historicalBasePaymentIsNotOverOrUnderCreditedAfterCatalogPriceChange() {
        var environment = new MockEnvironment().withProperty("aichat.virtual-pay.base-price-fen", "3990")
                .withProperty("aichat.virtual-pay.career-price-fen", "5990").withProperty("aichat.virtual-pay.upgrade-price-fen", "2000");
        var mapper = mock(VirtualPaymentMapper.class);
        var json = new ObjectMapper();
        var policy = new GrowthReportPurchasePolicy(mapper, new VirtualPaySettings(environment), json, environment);
        var base = mock(VirtualPaymentMapper.Order.class);
        when(base.hasActiveEntitlement()).thenReturn(true);
        when(base.id()).thenReturn("old-base");
        when(base.paidFen()).thenReturn(2990);
        when(mapper.activePurchase(anyString())).thenAnswer(call -> call.getArgument(0, String.class)
                .equals(GrowthReportPurchasePolicy.purchaseKey("buyer", com.aichat.kernel.security.Sha256Fingerprints.hash("{}"), "base")) ? base : null);
        assertThatThrownBy(() -> policy.quote("buyer", "career", json.createObjectNode()))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.error().code()).isEqualTo("UPGRADE_PRICE_UNAVAILABLE"));
        var career = mock(VirtualPaymentMapper.Order.class);
        when(mapper.activePurchase(anyString())).thenAnswer(call -> call.getArgument(0, String.class)
                .equals(GrowthReportPurchasePolicy.purchaseKey("buyer", com.aichat.kernel.security.Sha256Fingerprints.hash("{}"), "base")) ? base : career);
        assertThat(policy.quote("buyer", "career", json.createObjectNode()).existing()).isSameAs(career);
    }
}
