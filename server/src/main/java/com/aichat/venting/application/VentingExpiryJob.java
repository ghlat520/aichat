package com.aichat.venting.application;

import com.aichat.venting.infrastructure.VentingMapper;
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
public class VentingExpiryJob {
    private static final Logger log = LoggerFactory.getLogger(VentingExpiryJob.class);

    private final VentingMapper mapper;
    private final Clock clock;

    public VentingExpiryJob(VentingMapper mapper, Clock clock) {
        this.mapper = mapper;
        this.clock = clock;
    }

    @Scheduled(
            fixedDelayString = "${aichat.venting.cleanup-ms:3600000}",
            initialDelayString = "${aichat.venting.cleanup-initial-ms:3600000}"
    )
    @Transactional
    public void deleteExpiredData() {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        int turns = mapper.deleteExpiredTurns(now);
        int summaries = mapper.deleteExpiredSummaries(now);
        int commands = mapper.deleteExpiredCommands(now);
        if (turns + summaries + commands > 0) {
            log.info(
                    "Expired venting data deleted turns={} summaries={} commands={}",
                    turns,
                    summaries,
                    commands
            );
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int deleteExpiredCommand(String scope, String owner, String keyHash, LocalDateTime now) {
        return mapper.deleteExpiredCommand(scope, owner, keyHash, now);
    }
}
