package com.aichat.contract;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.UniqueElements;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * OpenAPI request schema 的 Java 边界模型。字段名用 JsonProperty 保持契约中的 snake_case；
 * 敏感原文只存在于请求对象，不应写入普通日志或异常详情。
 */
public final class ContractRequests {
    private ContractRequests() {
    }

    public record ExpectedVersionRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion
    ) {
    }

    public record CreateSessionRequest(
            @JsonProperty("client_instance_id") @NotBlank @Size(min = 16, max = 128) String clientInstanceId,
            @JsonProperty("device_class")
            @Pattern(regexp = "low|mainstream|unknown") String deviceClass
    ) {
    }

    public record ConsentRequest(
            @JsonProperty("policy_version") @NotBlank @Size(max = 64) String policyVersion,
            @JsonProperty("adult_confirmed") @AssertTrue boolean adultConfirmed,
            @AssertTrue boolean accepted
    ) {
    }

    public record WechatBindRequest(
            @JsonProperty("login_code") @NotBlank @Size(max = 256) String loginCode,
            @NotBlank @Pattern(regexp = "payment|cross_device_recovery|reminder|refund") String purpose
    ) {
    }

    public record CreateAssessmentRunRequest(
            @JsonProperty("definition_version") @NotBlank @Size(max = 64) String definitionVersion
    ) {
    }

    public record AssessmentAnswerRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @JsonProperty("option_code") @NotBlank @Size(max = 64) String optionCode
    ) {
    }

    public record CreateVentSessionRequest(
            @JsonProperty("policy_version") @NotBlank @Size(max = 64) String policyVersion
    ) {
    }

    public record VentTurnRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotBlank @Size(max = 2000) String text
    ) {
    }

    public record VentSummaryRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotNull Boolean confirmed,
            @NotBlank @Size(max = 3000) String summary
    ) {
    }

    public record CreateTaskRequest(
            @JsonProperty("entry_type") @NotBlank @Pattern(regexp = "DIRECT|ASSESSMENT|VENT") String entryType,
            @NotBlank
            @Pattern(regexp = "dating_or_partner|family|friendship|workplace|other_relationship") String context,
            @JsonProperty("clarity_pre") @NotNull @Min(0) @Max(10) Integer clarityPre
    ) {
    }

    public record ClarityFieldsRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotNull @Valid ClarityFields fields
    ) {
    }

    public record ClarityFields(
            @NotBlank @Size(max = 64) String context,
            @JsonProperty("observed_fact") @NotBlank @Size(max = 2000) String observedFact,
            @NotBlank @Size(max = 2000) String interpretation,
            @NotEmpty @Size(max = 5) @UniqueElements List<@Size(max = 40) String> emotion,
            @JsonProperty("need_or_boundary")
            @NotEmpty @Size(max = 5) @UniqueElements List<@Size(max = 80) String> needOrBoundary,
            @JsonProperty("next_step_goal") @NotBlank @Size(max = 500) String nextStepGoal
    ) {
    }

    public record MirrorConfirmationRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @JsonProperty("content_version") @NotBlank @Ulid String contentVersion,
            @NotNull Boolean confirmed,
            Map<String, @Size(max = 2000) String> corrections
    ) {
    }

    public record ReflectionRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @Min(1) @Max(2) int round,
            @NotBlank @Size(max = 2000) String answer
    ) {
    }

    public record CreateReportRequest(
            @JsonProperty("expected_task_version") @Min(1) int expectedTaskVersion,
            @JsonProperty("confirmed_content_version") @NotBlank @Ulid String confirmedContentVersion,
            @JsonProperty("reflection_versions")
            @NotNull @Size(min = 2, max = 2) @UniqueElements List<@Ulid String> reflectionVersions
    ) {
    }

    public record CopyReceiptRequest(
            @JsonProperty("section_code") @NotBlank @Size(max = 64) String sectionCode
    ) {
    }

    public record ActionRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotBlank @Pattern(regexp = "SELECT|EDIT|REJECT") String decision,
            @JsonProperty("action_text") @Size(min = 1, max = 500) String actionText
    ) {
    }

    public record ReminderGrantRequest(
            @NotBlank @Pattern(regexp = "72h|d7") String stage,
            @JsonProperty("template_version") @NotBlank @Size(max = 64) String templateVersion,
            @AssertTrue boolean consent
    ) {
    }

    public record CheckinRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotBlank @Pattern(regexp = "done|partly_done|not_done|no_longer_needed") String result,
            @JsonProperty("clarity_post") @Min(0) @Max(10) Integer clarityPost,
            @Size(max = 1000) String note
    ) {
    }

    public record CreateOrderRequest(
            @JsonProperty("report_id") @NotBlank @Ulid String reportId,
            @NotBlank @Pattern(regexp = "RELATIONSHIP_CLARITY_CARD_V1") String sku,
            @JsonProperty("purchase_disclosure_version")
            @NotBlank @Size(max = 64) String purchaseDisclosureVersion,
            @AssertTrue boolean accepted
    ) {
    }

    public record WechatPayNotification(
            @NotBlank @Size(max = 128) String id,
            @JsonProperty("create_time") @NotNull OffsetDateTime createTime,
            @JsonProperty("event_type") @NotBlank @Size(max = 64) String eventType,
            @JsonProperty("resource_type") @NotBlank @Size(max = 64) String resourceType,
            @Size(max = 256) String summary,
            @NotNull Map<String, Object> resource
    ) {
    }

    public record RefundRequest(
            @JsonProperty("reason_code") @NotBlank
            @Pattern(regexp = "delivery_failure|duplicate_payment|misleading|safety|privacy|other")
            String reasonCode,
            @NotBlank @Size(max = 1000) String statement
    ) {
    }

    public record PrivacyScopeRequest(
            @NotBlank @Pattern(regexp = "current_task|all_content|all_deletable_data") String scope,
            @AssertTrue boolean confirmed
    ) {
    }

    public record SupportTicketRequest(
            @NotBlank @Pattern(regexp = "billing|refund|delivery|safety|privacy|misleading|correction")
            String category,
            @JsonProperty("resource_ref") @Ulid String resourceRef,
            @NotBlank @Size(max = 3000) String statement
    ) {
    }

    public record CreatePriceVersionRequest(
            @NotBlank @Size(max = 64) String sku,
            @JsonProperty("amount_fen") @Min(1) long amountFen,
            @NotBlank @Pattern(regexp = "CNY") String currency,
            @JsonProperty("effective_from") @NotNull OffsetDateTime effectiveFrom,
            @JsonProperty("effective_until") OffsetDateTime effectiveUntil,
            @NotBlank @Size(min = 10, max = 500) String reason,
            @NotBlank @Size(max = 128) String ticket
    ) {
    }

    public record OpsCommandRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @Size(max = 64) String action,
            @NotBlank @Size(min = 10, max = 1000) String reason,
            @NotBlank @Size(max = 128) String ticket
    ) {
    }

    public record FeatureFlagRequest(
            @NotBlank @Pattern(regexp = "assessment|venting|generation|payment|reminder") String key,
            @NotBlank @Pattern(regexp = "test|staging|production") String environment,
            @NotNull Boolean value,
            @JsonProperty("expected_revision") @NotNull @Min(0) Long expectedRevision,
            @NotBlank @Size(min = 10, max = 500) String reason,
            @NotBlank @Size(max = 128) String ticket
    ) {
    }

    public record ArtifactVersionRequest(
            @JsonProperty("artifact_type") @NotBlank
            @Pattern(regexp = "assessment|prompt|model|safety_rule|report_template|policy") String artifactType,
            @NotBlank @Size(max = 128) String version,
            @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String sha256,
            @JsonProperty("evidence_ref") @NotBlank @Size(max = 512) String evidenceRef
    ) {
    }

    public record ReleaseRequest(
            @NotBlank @Size(max = 128) String version,
            @JsonProperty("artifact_versions")
            @NotEmpty @UniqueElements List<@Size(max = 128) String> artifactVersions,
            @JsonProperty("evidence_refs")
            @NotEmpty @UniqueElements List<@Size(max = 512) String> evidenceRefs,
            @JsonProperty("rollback_ref") @NotBlank @Size(max = 512) String rollbackRef,
            @NotBlank @Size(min = 10, max = 1000) String reason,
            @NotBlank @Size(max = 128) String ticket
    ) {
    }

    public record ExperimentRequest(
            @NotBlank @Size(max = 128) String key,
            @NotBlank @Size(min = 10, max = 1000) String hypothesis,
            @NotNull @Size(min = 2, max = 5) @UniqueElements List<@Size(max = 64) String> variants,
            @JsonProperty("primary_metric") @NotBlank @Size(max = 128) String primaryMetric,
            @JsonProperty("stop_conditions")
            @NotEmpty List<@Size(max = 256) String> stopConditions,
            @NotBlank @Size(min = 10, max = 1000) String reason,
            @NotBlank @Size(max = 128) String ticket
    ) {
    }
}
