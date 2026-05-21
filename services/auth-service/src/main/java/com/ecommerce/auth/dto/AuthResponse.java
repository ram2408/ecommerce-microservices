package com.ecommerce.auth.dto;

public record AuthResponse(String token, String email, String name, String role) {}
