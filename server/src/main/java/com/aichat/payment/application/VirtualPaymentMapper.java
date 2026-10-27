package com.aichat.payment.application;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface VirtualPaymentMapper {
    @Select("SELECT id FROM id_visitor_session WHERE id = #{id} FOR UPDATE")
    String lockVisitor(String id);

    @Select("SELECT * FROM pay_virtual_buyer WHERE buyer_id = #{id}")
    Buyer buyer(String id);

    @Select("SELECT * FROM pay_virtual_buyer WHERE buyer_id = #{id} FOR UPDATE")
    Buyer lockBuyer(String id);

    @Insert("INSERT INTO pay_virtual_buyer (buyer_id, app_id, encrypted_openid, created_at) VALUES (#{buyerId}, #{appId}, #{encryptedOpenid}, #{createdAt}) ON DUPLICATE KEY UPDATE buyer_id = VALUES(buyer_id)")
    int insertBuyer(Buyer buyer);

    @Select("SELECT * FROM id_wechat_payment_session WHERE visitor_session_id = #{id}")
    Binding binding(String id);

    @Insert("INSERT INTO id_wechat_payment_session (visitor_session_id, buyer_id, encrypted_session_key, authenticated_at) VALUES (#{visitorSessionId}, #{buyerId}, #{encryptedSessionKey}, #{authenticatedAt})")
    int insertBinding(Binding binding);

    @Update("UPDATE id_wechat_payment_session SET encrypted_session_key = #{encryptedSessionKey}, authenticated_at = #{authenticatedAt} WHERE visitor_session_id = #{visitorSessionId} AND buyer_id = #{buyerId}")
    int refreshBinding(Binding binding);

    @Update("UPDATE id_wechat_payment_session SET encrypted_session_key = NULL WHERE authenticated_at < #{before} AND encrypted_session_key IS NOT NULL")
    int expireSessionKeys(LocalDateTime before);

    @Select("SELECT * FROM pay_virtual_order WHERE id = #{id}")
    Order order(String id);

    @Select("SELECT * FROM pay_virtual_order WHERE id = #{id} FOR UPDATE")
    Order lockOrder(String id);

    @Select("SELECT * FROM pay_virtual_order WHERE active_purchase_key = #{key}")
    Order activePurchase(String key);

    @Select("SELECT * FROM pay_virtual_order WHERE buyer_id = #{buyer} AND idempotency_key_hash = #{key}")
    Order requestOrder(@Param("buyer") String buyer, @Param("key") String key);

    @Select("<script>SELECT * FROM pay_virtual_order WHERE buyer_id = #{buyer}<if test='before != null'> AND id &lt; #{before}</if> ORDER BY id DESC LIMIT 21</script>")
    List<Order> orders(@Param("buyer") String buyer, @Param("before") String before);

    @Select("SELECT * FROM pay_virtual_order WHERE next_query_at <= #{now} AND (payment_state = 'PENDING' OR (payment_state = 'PAID' AND (delivery_confirmed_at IS NULL OR refund_state = 'PROCESSING'))) ORDER BY next_query_at, id LIMIT 50")
    List<Order> dueOrders(LocalDateTime now);

    @Insert("""
            INSERT INTO pay_virtual_order (
                id, buyer_id, app_id, environment_no, sku, product_id, offer_id,
                snapshot_key, input_hash, encrypted_snapshot, price_fen, base_order_id,
                active_upgrade_base_id, active_purchase_key, idempotency_key_hash, request_hash,
                payment_state, refund_state, refunded_fen, entitlement_state,
                next_query_at, purchase_disclosure_version, report_version, created_at, updated_at
            ) VALUES (
                #{id}, #{buyerId}, #{appId}, #{environmentNo}, #{sku}, #{productId}, #{offerId},
                #{snapshotKey}, #{inputHash}, #{encryptedSnapshot}, #{priceFen}, #{baseOrderId},
                #{activeUpgradeBaseId}, #{activePurchaseKey}, #{idempotencyKeyHash}, #{requestHash},
                #{paymentState}, #{refundState}, #{refundedFen}, #{entitlementState},
                #{nextQueryAt}, #{purchaseDisclosureVersion}, #{reportVersion}, #{createdAt}, #{updatedAt}
            )
            """)
    int insertOrder(Order order);

    @Update("""
            UPDATE pay_virtual_order SET payment_state = 'PAID',
                wx_order_id = #{wxOrderId}, channel_order_id = #{channelOrderId}, wxpay_order_id = #{wxpayOrderId},
                paid_fen = #{paidFen}, paid_at = #{paidAt}, entitlement_state = #{entitlement}, updated_at = #{now}
             WHERE id = #{id}
            """)
    int markPaid(@Param("id") String id, @Param("wxOrderId") String wxOrderId,
                 @Param("channelOrderId") String channelOrderId, @Param("wxpayOrderId") String wxpayOrderId,
                 @Param("paidFen") int paidFen, @Param("paidAt") LocalDateTime paidAt,
                 @Param("entitlement") String entitlement, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET payment_state = 'CLOSED', active_purchase_key = NULL, active_upgrade_base_id = NULL, updated_at = #{now} WHERE id = #{id} AND payment_state = 'PENDING'")
    int markClosed(@Param("id") String id, @Param("now") LocalDateTime now);

    @Update("""
            UPDATE pay_virtual_order SET refunded_fen = #{total}, refund_state = #{state},
                entitlement_state = #{entitlement}, updated_at = #{now},
                active_purchase_key = CASE WHEN #{state} = 'COMPLETED' THEN NULL ELSE active_purchase_key END,
                active_upgrade_base_id = CASE WHEN #{state} = 'COMPLETED' THEN NULL ELSE active_upgrade_base_id END
             WHERE id = #{id}
            """)
    int markRefund(@Param("id") String id, @Param("total") int total, @Param("state") String state,
                   @Param("entitlement") String entitlement, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET entitlement_state = 'SUSPENDED', updated_at = #{now} WHERE active_upgrade_base_id = #{base} AND entitlement_state <> 'REVOKED'")
    int suspendUpgrade(@Param("base") String baseOrderId, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET delivery_confirmed_at = COALESCE(delivery_confirmed_at, #{now}) WHERE id = #{id}")
    int confirmDelivery(@Param("id") String id, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET refund_state = 'PROCESSING', entitlement_state = 'SUSPENDED', wx_order_id = COALESCE(wx_order_id, #{wxOrderId}), updated_at = #{now} WHERE id = #{id} AND refund_state = 'NONE' AND payment_state IN ('PENDING', 'PAID')")
    int observeRefundProcessing(@Param("id") String id, @Param("wxOrderId") String wxOrderId, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET payment_prepared_at = #{now}, payment_preparation_key_hash = #{key}, encrypted_payment_parameters = #{encrypted} WHERE id = #{id} AND payment_prepared_at IS NULL AND payment_state = 'PENDING'")
    int claimPayment(@Param("id") String id, @Param("key") String key, @Param("encrypted") byte[] encrypted, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET refund_state = 'NONE', entitlement_state = #{entitlement}, updated_at = #{now} WHERE id = #{id} AND refund_state = 'PROCESSING' AND refunded_fen = 0 AND payment_state IN ('PENDING', 'PAID')")
    int clearFailedRefund(@Param("id") String id, @Param("entitlement") String entitlement, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET entitlement_state = 'ACTIVE', updated_at = #{now} WHERE active_upgrade_base_id = #{base} AND entitlement_state = 'SUSPENDED' AND payment_state = 'PAID' AND refund_state = 'NONE'")
    int resumeUpgrade(@Param("base") String base, @Param("now") LocalDateTime now);

    @Update("UPDATE pay_virtual_order SET last_query_attempt_at = #{now}, next_query_at = #{next} WHERE id = #{id}")
    int postponeQuery(@Param("id") String id, @Param("now") LocalDateTime now, @Param("next") LocalDateTime next);

    @Update("UPDATE pay_virtual_order SET query_version = query_version + 1, last_query_attempt_at = #{now}, next_query_at = #{next} WHERE id = #{id}")
    int advanceQuery(@Param("id") String id, @Param("now") LocalDateTime now, @Param("next") LocalDateTime next);

    @Update("UPDATE pay_virtual_order SET encrypted_support = #{encrypted}, support_requested_at = #{now}, updated_at = #{now} WHERE id = #{id}")
    int requestSupport(@Param("id") String id, @Param("encrypted") byte[] encrypted, @Param("now") LocalDateTime now);

    @Select("SELECT * FROM pay_virtual_receipt WHERE receipt_id = #{id}")
    Receipt receipt(String id);

    @Select("SELECT * FROM pay_virtual_receipt WHERE app_id = #{app} AND environment_no = #{environment} AND completed_refund_id = #{id}")
    Receipt completedRefund(@Param("app") String app, @Param("environment") int environment, @Param("id") String id);

    @Insert("""
            INSERT INTO pay_virtual_receipt (
                receipt_id, order_id, app_id, environment_no, receipt_kind, provider_order_id,
                completed_refund_id, amount_fen, encrypted_evidence, observed_at
            ) VALUES (#{receiptId}, #{orderId}, #{appId}, #{environmentNo}, #{receiptKind}, #{providerOrderId},
                #{completedRefundId}, #{amountFen}, #{encryptedEvidence}, #{observedAt})
            """)
    int insertReceipt(Receipt receipt);

    record Buyer(String buyerId, String appId, byte[] encryptedOpenid, LocalDateTime createdAt) { }
    record Binding(String visitorSessionId, String buyerId, byte[] encryptedSessionKey, LocalDateTime authenticatedAt) { }
    record Order(String id, String buyerId, String appId, int environmentNo, String sku, String productId,
                 String offerId, String snapshotKey, String inputHash, byte[] encryptedSnapshot, int priceFen,
                 String baseOrderId, String activeUpgradeBaseId, String activePurchaseKey,
                 String idempotencyKeyHash, String requestHash, String paymentState, String refundState,
                 int refundedFen, String entitlementState, String wxOrderId, String channelOrderId, String wxpayOrderId,
                 Integer paidFen, LocalDateTime paidAt, LocalDateTime deliveryConfirmedAt,
                 LocalDateTime lastQueryAttemptAt, LocalDateTime nextQueryAt, String purchaseDisclosureVersion,
                 String reportVersion, byte[] encryptedSupport, LocalDateTime supportRequestedAt,
                 LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime paymentPreparedAt,
                 String paymentPreparationKeyHash, byte[] encryptedPaymentParameters, long queryVersion) {
        public boolean hasActiveEntitlement() {
            return "PAID".equals(paymentState) && "ACTIVE".equals(entitlementState) && "NONE".equals(refundState);
        }
    }
    record Receipt(String receiptId, String orderId, String appId, int environmentNo, String receiptKind,
                   String providerOrderId, String completedRefundId, int amountFen, byte[] encryptedEvidence,
                   LocalDateTime observedAt) { }
}
