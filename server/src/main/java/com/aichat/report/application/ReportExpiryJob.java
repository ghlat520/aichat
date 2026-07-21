package com.aichat.report.application;

import com.aichat.report.infrastructure.ReportMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Component
public class ReportExpiryJob {
    private static final Logger log = LoggerFactory.getLogger(ReportExpiryJob.class);

    private final ReportMapper mapper;
    private final Clock clock;

    public ReportExpiryJob(ReportMapper mapper, Clock clock) {
        this.mapper = mapper;
        this.clock = clock;
    }

    @Scheduled(
            fixedDelayString = "${aichat.idempotency.cleanup-ms:3600000}",
            initialDelayString = "${aichat.idempotency.cleanup-initial-ms:3600000}"
    )
    @Transactional
    public void deleteExpiredCommands() {
        int commands = mapper.deleteExpiredCommands(utcNow());
        if (commands > 0) log.info("Expired report commands deleted count={}", commands);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int deleteExpiredCommand(String scope, String owner, String keyHash, LocalDateTime now) {
        return mapper.deleteExpiredCommand(scope, owner, keyHash, now);
    }

    private LocalDateTime utcNow() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
