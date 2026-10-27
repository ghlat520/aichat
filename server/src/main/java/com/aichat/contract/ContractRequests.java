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

    public record GrowthPurchaseExperience(
            @NotBlank @Size(max = 1000) String event,
            @NotBlank @Size(max = 1000) String action,
            @NotBlank @Size(max = 1000) String result,
            @NotNull @Size(max = 1000) String energy
    ) { }

    public record GrowthPurchaseCareer(
            @NotNull @Size(max = 10) List<@NotBlank @Size(max = 64) String> interests,
            @NotNull @Size(max = 10) List<@NotBlank @Size(max = 64) String> values,
            @NotNull @Size(max = 1000) String skills,
            @NotNull @Size(max = 1000) String goal,
            @NotNull @Size(max = 1000) String time,
            @NotNull @Size(max = 1000) String constraints
    ) { }

    public record GrowthPurchaseSnapshot(
            @NotNull @Size(max = 3) Map<String, List<@Min(1) @Max(5) Integer>> answers,
            @NotNull @Size(max = 3) Map<String, Boolean> results,
            @NotNull @Size(max = 3) Map<String, Map<String, String>> sources,
            @NotNull @Size(min = 2, max = 2) List<@NotNull @Valid GrowthPurchaseExperience> experiences,
            @NotNull @Size(max = 5) List<@NotBlank @Size(max = 64) String> goals,
            @AssertTrue boolean confirmed,
            @Valid GrowthPurchaseCareer career
    ) { }

    public record VirtualQuoteRequest(
            @NotBlank @Pattern(regexp = "base|career") String product,
            @NotNull @Valid GrowthPurchaseSnapshot snapshot
    ) { }

    public record VirtualOrderRequest(
            @NotBlank @Pattern(regexp = "base|career") String product,
            @NotNull @Valid GrowthPurchaseSnapshot snapshot,
            @JsonProperty("price_version") @NotBlank @Size(max = 64) String priceVersion,
            @JsonProperty("purchase_disclosure_version") @NotBlank @Size(max = 64) String purchaseDisclosureVersion,
            @AssertTrue boolean accepted
    ) { }

    public record VirtualSupportRequest(
            @NotBlank @Size(max = 64) String reason,
            @NotBlank @Size(max = 1000) String detail
    ) { }

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

    public record AssessmentTaskMappingRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotBlank
            @Pattern(regexp = "dating_or_partner|family|friendship|workplace|other_relationship") String context,
            @JsonProperty("clarity_pre") @NotNull @Min(0) @Max(10) Integer clarityPre,
            @AssertTrue boolean confirmed
    ) {
    }

    public record CreateVentSessionRequest(
            @JsonProperty("policy_version") @NotBlank @Size(max = 64) String policyVersion,
            @AssertTrue boolean confirmed
    ) {
    }

    public record VentTurnRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotBlank @Size(max = 2000) String text
    ) {
    }

    public record VentSummaryRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @JsonProperty("summary_version") @NotBlank @Ulid String summaryVersion,
            @AssertTrue boolean confirmed,
            @NotNull @Valid VentSummaryFields fields
    ) {
    }

    public record VentSummaryFields(
            @NotBlank
            @Pattern(regexp = "dating_or_partner|family|friendship|workplace|other_relationship") String context,
            @JsonProperty("observed_fact") @NotBlank @Size(min = 20, max = 500) String observedFact,
            @JsonProperty("looping_thought") @NotNull @Size(max = 500) String loopingThought,
            @NotEmpty @Size(max = 3) @UniqueElements
            List<@Pattern(regexp = "anxious|hurt|angry|confused|sad|hopeful|afraid|disappointed|calm|other") String> emotion,
            @JsonProperty("need_or_boundary")
            @NotEmpty @Size(max = 3) @UniqueElements List<@NotBlank @Size(max = 80) String> needOrBoundary,
            @JsonProperty("current_goal") @NotBlank @Size(max = 200) String currentGoal,
            @JsonProperty("clarity_pre") @NotNull @Min(0) @Max(10) Integer clarityPre
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
            @NotBlank
            @Pattern(regexp = "dating_or_partner|family|friendship|workplace|other_relationship") String context,
            @JsonProperty("observed_fact") @NotBlank @Size(min = 20, max = 500) String observedFact,
            @NotNull @Size(max = 500) String interpretation,
            @NotEmpty @Size(max = 3) @UniqueElements
            List<@Pattern(regexp = "anxious|hurt|angry|confused|sad|hopeful|afraid|disappointed|calm|other") String> emotion,
            @JsonProperty("need_or_boundary")
            @NotEmpty @Size(max = 3) @UniqueElements List<@Size(max = 80) String> needOrBoundary,
            @JsonProperty("next_step_goal") @NotBlank @Size(max = 200) String nextStepGoal
    ) {
    }

    public record MirrorConfirmationRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @JsonProperty("content_version") @NotBlank @Ulid String contentVersion,
            @AssertTrue boolean confirmed,
            @NotNull @Valid MirrorEvaluations evaluations
    ) {
    }

    public record MirrorEvaluations(
            @JsonProperty("confirmed_event") @NotNull @Valid MirrorSectionEvaluation confirmedEvent,
            @JsonProperty("current_interpretation") @NotNull @Valid MirrorSectionEvaluation currentInterpretation,
            @NotNull @Valid MirrorSectionEvaluation feelings,
            @JsonProperty("need_or_boundary") @NotNull @Valid MirrorSectionEvaluation needOrBoundary,
            @JsonProperty("question_to_solve") @NotNull @Valid MirrorSectionEvaluation questionToSolve
    ) {
    }

    public record MirrorSectionEvaluation(
            @NotBlank @Pattern(regexp = "accurate|partially_accurate|inaccurate") String accuracy,
            @Size(min = 1, max = 500) String correction
    ) {
    }

    public record ReflectionRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @Min(1) @Max(2) int round,
            @JsonProperty("confirmed_facts")
            @Size(min = 1, max = 5) @UniqueElements
            List<@NotBlank @Size(max = 500) String> confirmedFacts,
            @JsonProperty("unknowns_to_verify")
            @Size(min = 1, max = 5) @UniqueElements
            List<@NotBlank @Size(max = 500) String> unknownsToVerify,
            @JsonProperty("priority_need_or_boundary") @Size(min = 1, max = 300) String priorityNeedOrBoundary,
            @JsonProperty("self_executable_goal") @Size(min = 1, max = 300) String selfExecutableGoal
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

    public record SafetyReviewDecisionRequest(
            @JsonProperty("expected_version") @Min(1) int expectedVersion,
            @NotBlank @Pattern(regexp = "CONFIRMED_BLOCK|FALSE_POSITIVE|POLICY_GAP|ESCALATED")
            String decision,
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
