package com.aichat.kernel.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public final class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiEnvelope<Void>> handleApiException(ApiException exception, HttpServletRequest request) {
        return ResponseEntity.status(exception.status())
                .body(ApiEnvelope.failure(RequestIdFilter.from(request), exception.error()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiEnvelope<Void>> handleBodyValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, Object> fields = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "请求字段校验失败", false,
                Map.of("fields", fields), request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiEnvelope<Void>> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request
    ) {
        Map<String, Object> violations = new LinkedHashMap<>();
        exception.getConstraintViolations().forEach(violation ->
                violations.put(violation.getPropertyPath().toString(), violation.getMessage()));
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "请求参数校验失败", false,
                Map.of("fields", violations), request);
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MissingRequestHeaderException.class,
            MissingServletRequestParameterException.class
    })
    ResponseEntity<ApiEnvelope<Void>> handleMalformedRequest(Exception exception, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "请求格式或必填参数不正确", false,
                Map.of(), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiEnvelope<Void>> handleNotFound(NoResourceFoundException exception, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "请求资源不存在", false, Map.of(), request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiEnvelope<Void>> handleMethodNotAllowed(
            HttpRequestMethodNotSupportedException exception,
            HttpServletRequest request
    ) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "请求方法不受支持", false,
                Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiEnvelope<Void>> handleUnexpected(Exception exception, HttpServletRequest request) {
        String requestId = RequestIdFilter.from(request);
        log.error("Unexpected API failure request_id={} exception_type={}",
                requestId, exception.getClass().getName());
        ApiError apiError = new ApiError("INTERNAL_ERROR", "服务暂时不可用", true, Map.of());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiEnvelope.failure(requestId, apiError));
    }

    private ResponseEntity<ApiEnvelope<Void>> error(
            HttpStatus status,
            String code,
            String message,
            boolean retryable,
            Map<String, Object> details,
            HttpServletRequest request
    ) {
        ApiError apiError = new ApiError(code, message, retryable, details);
        return ResponseEntity.status(status)
                .body(ApiEnvelope.failure(RequestIdFilter.from(request), apiError));
    }
}
