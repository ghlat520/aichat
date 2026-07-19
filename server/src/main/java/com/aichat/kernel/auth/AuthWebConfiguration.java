package com.aichat.kernel.auth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Optional;

@Configuration
public class AuthWebConfiguration implements WebMvcConfigurer {
    private final SubjectResolver subjectResolver;

    public AuthWebConfiguration(SubjectResolver subjectResolver) {
        this.subjectResolver = subjectResolver;
    }

    @Bean
    @ConditionalOnMissingBean(SubjectResolver.class)
    static SubjectResolver denyAllSubjectResolver() {
        return (request, policy) -> Optional.empty();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AuthPolicyInterceptor(subjectResolver, new AuthClassificationResolver()));
    }
}
