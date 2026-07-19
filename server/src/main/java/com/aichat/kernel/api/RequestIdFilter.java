package com.aichat.kernel.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public final class RequestIdFilter extends OncePerRequestFilter {
    public static final String ATTRIBUTE = RequestIdFilter.class.getName() + ".requestId";
    public static final String HEADER = "X-Request-ID";
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("^[A-Za-z0-9._:-]{1,128}$");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String supplied = request.getHeader(HEADER);
        String requestId = supplied != null && SAFE_REQUEST_ID.matcher(supplied).matches()
                ? supplied
                : UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, requestId);
        response.setHeader(HEADER, requestId);
        filterChain.doFilter(request, response);
    }

    public static String from(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE);
        return value instanceof String requestId ? requestId : UUID.randomUUID().toString();
    }
}
