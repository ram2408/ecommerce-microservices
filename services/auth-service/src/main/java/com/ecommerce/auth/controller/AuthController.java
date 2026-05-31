package com.ecommerce.auth.controller;

import com.ecommerce.auth.dto.AuthResponse;
import com.ecommerce.auth.dto.LoginRequest;
import com.ecommerce.auth.dto.RegisterRequest;
import com.ecommerce.auth.dto.OAuthRequest;
import com.ecommerce.auth.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> loginWithGoogle(@RequestBody OAuthRequest request) {
        return ResponseEntity.ok(authService.loginWithGoogle(request.tokenOrCode()));
    }

    @PostMapping("/github")
    public ResponseEntity<AuthResponse> loginWithGithub(@RequestBody OAuthRequest request) {
        return ResponseEntity.ok(authService.loginWithGithub(request.tokenOrCode()));
    }

    @GetMapping("/validate")
    public ResponseEntity<Boolean> validateToken(@RequestParam String token) {
        return ResponseEntity.ok(authService.validateToken(token));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<java.util.Map<String, String>> handleRuntimeException(RuntimeException ex) {
        return ResponseEntity.status(400)
                .body(java.util.Map.of("error", ex.getMessage()));
    }
}
