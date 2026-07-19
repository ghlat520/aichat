package com.aichat.contract;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = {})
@Pattern(regexp = "[0-9A-HJKMNP-TV-Z]{26}")
@Size(min = 26, max = 26)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface Ulid {
    String message() default "必须是 26 位 ULID";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
