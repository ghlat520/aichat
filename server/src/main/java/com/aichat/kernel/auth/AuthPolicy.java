package com.aichat.kernel.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuthPolicy {
    String ruleId();

    String operatorPolicyRuleId() default "";

    AuthLevel level();

    AuthLevel[] accepted();

    String[] roles() default {};

    boolean mfaRequired() default false;

    boolean rawBodyRequired() default false;
}
