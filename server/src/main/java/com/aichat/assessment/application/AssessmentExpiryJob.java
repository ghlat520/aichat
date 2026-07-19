package com.aichat.assessment.application;

import com.aichat.assessment.infrastructure.AssessmentMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Component
public class AssessmentExpiryJob {
    private static final Logger log = LoggerFactory.getLogger(AssessmentExpiryJob.class);

    private final AssessmentMapper mapper;
    private final Clock clock;

    public AssessmentExpiryJob(AssessmentMapper mapper, Clock clock) {
        this.mapper = mapper;
        this.clock = clock;
    }

    @Scheduled(
            fixedDelayString = "${aichat.assessment.answer-cleanup-ms:3600000}",
            initialDelayString = "${aichat.assessment.answer-cleanup-initial-ms:3600000}"
    )
    @Transactional
    public void deleteExpiredData() {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        int answers = mapper.deleteExpiredAnswers(now);
        int previews = mapper.deleteExpiredSharePreviews(now);
        if (answers + previews > 0) {
            log.info("Expired assessment data deleted answers={} share_previews={}", answers, previews);
        }
    }
}
