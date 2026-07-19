package com.aichat.assessment.application;

import com.aichat.kernel.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public final class AssessmentResultCatalog {
    private static final Map<String, ResultCopy> RESULTS = Map.of(
            "evidence_checking", new ResultCopy(
                    "当前更常先核对信息",
                    "能主动区分可观察事实与自己的推测",
                    "可能在等待更多信息时延后表达真实需要",
                    "先写下一个已经发生的事实，再提出一个可验证的问题"
            ),
            "direct_expression", new ResultCopy(
                    "当前更常直接表达",
                    "愿意把自己的理解和需要说清楚",
                    "可能在情绪仍高时过早进入沟通",
                    "用一句事实、感受和需要开始下一次沟通"
            ),
            "self_protection", new ResultCopy(
                    "当前更常先保护边界",
                    "能较快察觉不舒服的互动并保护自己",
                    "可能在信息仍不完整时先退出交流",
                    "说清一个边界，同时保留一个可重新评估的条件"
            ),
            "emotion_regulation", new ResultCopy(
                    "当前更常先恢复稳定",
                    "能在情绪高点为自己争取暂停空间",
                    "可能在暂停后没有回到需要处理的现实问题",
                    "暂停时同时约定一个自己可以回看问题的时间"
            ),
            "mixed", new ResultCopy(
                    "当前呈现混合倾向",
                    "会根据不同压力情境调用多种应对方式",
                    "选择可能随情绪和关系情境变化，需要回到具体事件",
                    "选一个最近发生的事件，只确认一个本人可执行的小行动"
            )
    );

    public ResultCopy require(String resultCode) {
        ResultCopy result = RESULTS.get(resultCode);
        if (result == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "ASSESSMENT_STATE_CORRUPTED", "自测结果状态异常");
        }
        return result;
    }

    public record ResultCopy(
            String currentTendency,
            String usableStrength,
            String possibleBlindSpot,
            String oneRealWorldReminder
    ) {
    }
}
