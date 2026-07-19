package com.aichat.kernel.auth;

public enum AuthLevel {
    PUBLIC(0),
    VISITOR(10),
    PRINCIPAL(20),
    INTERNAL(30),
    OPERATOR(40);

    private final int rank;

    AuthLevel(int rank) {
        this.rank = rank;
    }

    public int rank() {
        return rank;
    }
}
