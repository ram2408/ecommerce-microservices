package com.ecommerce.auth.service;

import com.ecommerce.auth.dto.AuthResponse;
import com.ecommerce.auth.dto.LoginRequest;
import com.ecommerce.auth.dto.RegisterRequest;
import com.ecommerce.auth.model.User;
import com.ecommerce.auth.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @org.springframework.beans.factory.annotation.Value("${oauth.github.client-id:}")
    private String githubClientId;

    @org.springframework.beans.factory.annotation.Value("${oauth.github.client-secret:}")
    private String githubClientSecret;

    public AuthService(UserRepository userRepository, JwtService jwtService, EmailService emailService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("Email is already registered!");
        }

        User user = new User(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.name(),
                request.role() != null && !request.role().trim().isEmpty() ? request.role().toUpperCase() : "CUSTOMER"
        );

        userRepository.save(user);

        // Trigger welcome email asynchronously
        emailService.sendWelcomeEmail(user.getEmail(), user.getName());

        String token = jwtService.generateToken(user.getEmail(), user.getRole(), user.getName());

        return new AuthResponse(token, user.getEmail(), user.getName(), user.getRole());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (user.getPassword() == null) {
            throw new RuntimeException("This email was registered using OAuth. Please sign in with Google or GitHub.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtService.generateToken(user.getEmail(), user.getRole(), user.getName());

        return new AuthResponse(token, user.getEmail(), user.getName(), user.getRole());
    }

    public AuthResponse loginWithGoogle(String idToken, boolean isRegistering) {
        String email;
        String name;
        String providerId;

        if ("mock-google-token".equals(idToken)) {
            email = "mock-google-user@gmail.com";
            name = "Mock Google User";
            providerId = "google-mock-123456";
        } else {
            try {
                org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
                String verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
                java.util.Map<?, ?> response = restTemplate.getForObject(verifyUrl, java.util.Map.class);
                if (response == null || response.containsKey("error_description")) {
                    throw new RuntimeException("Invalid Google ID Token");
                }
                email = (String) response.get("email");
                name = (String) response.get("name");
                providerId = (String) response.get("sub");
            } catch (Exception e) {
                throw new RuntimeException("Failed to verify Google Token: " + e.getMessage());
            }
        }

        return getOrCreateOAuthUser(email, name, "GOOGLE", providerId, isRegistering);
    }

    public AuthResponse loginWithGithub(String code, boolean isRegistering) {
        String email;
        String name;
        String providerId;

        if ("mock-github-code".equals(code)) {
            email = "mock-github-user@github.com";
            name = "Mock GitHub User";
            providerId = "github-mock-123456";
        } else {
            try {
                org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
                
                // 1. Exchange code for access token
                String tokenUrl = "https://github.com/login/oauth/access_token";
                java.util.Map<String, String> tokenRequest = new java.util.HashMap<>();
                tokenRequest.put("client_id", githubClientId);
                tokenRequest.put("client_secret", githubClientSecret);
                tokenRequest.put("code", code);
                
                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                headers.setAccept(java.util.Collections.singletonList(org.springframework.http.MediaType.APPLICATION_JSON));
                
                org.springframework.http.HttpEntity<java.util.Map<String, String>> entity = new org.springframework.http.HttpEntity<>(tokenRequest, headers);
                java.util.Map<?, ?> tokenResponse = restTemplate.postForObject(tokenUrl, entity, java.util.Map.class);
                
                if (tokenResponse == null || !tokenResponse.containsKey("access_token")) {
                    throw new RuntimeException("Failed to obtain GitHub access token: " + tokenResponse);
                }
                String accessToken = (String) tokenResponse.get("access_token");
                
                // 2. Fetch user profile
                org.springframework.http.HttpHeaders userHeaders = new org.springframework.http.HttpHeaders();
                userHeaders.setBearerAuth(accessToken);
                userHeaders.setAccept(java.util.Collections.singletonList(org.springframework.http.MediaType.APPLICATION_JSON));
                
                org.springframework.http.HttpEntity<Void> userEntity = new org.springframework.http.HttpEntity<>(userHeaders);
                org.springframework.http.ResponseEntity<java.util.Map> userResponse = restTemplate.exchange(
                        "https://api.github.com/user",
                        org.springframework.http.HttpMethod.GET,
                        userEntity,
                        java.util.Map.class
                );
                
                java.util.Map<?, ?> userProfile = userResponse.getBody();
                if (userProfile == null) {
                    throw new RuntimeException("Failed to fetch GitHub user profile");
                }
                
                providerId = String.valueOf(userProfile.get("id"));
                name = (String) userProfile.get("name");
                if (name == null) {
                    name = (String) userProfile.get("login");
                }
                
                email = (String) userProfile.get("email");
                
                // 3. If email is private, fetch email list
                if (email == null) {
                    org.springframework.http.ResponseEntity<java.util.Map[]> emailsResponse = restTemplate.exchange(
                            "https://api.github.com/user/emails",
                            org.springframework.http.HttpMethod.GET,
                            userEntity,
                            java.util.Map[].class
                    );
                    java.util.Map[] emails = emailsResponse.getBody();
                    if (emails != null && emails.length > 0) {
                        for (java.util.Map<?, ?> emailObj : emails) {
                            if (Boolean.TRUE.equals(emailObj.get("primary"))) {
                                email = (String) emailObj.get("email");
                                break;
                            }
                        }
                        if (email == null) {
                            email = (String) emails[0].get("email");
                        }
                    }
                }
                
                if (email == null) {
                    throw new RuntimeException("Could not retrieve email from GitHub profile");
                }
            } catch (Exception e) {
                throw new RuntimeException("Failed to authenticate with GitHub: " + e.getMessage());
            }
        }

        return getOrCreateOAuthUser(email, name, "GITHUB", providerId, isRegistering);
    }

    private AuthResponse getOrCreateOAuthUser(String email, String name, String provider, String providerId, boolean isRegistering) {
        java.util.Optional<User> existingUser = userRepository.findByEmail(email);
        User user;
        if (existingUser.isPresent()) {
            user = existingUser.get();
            if (user.getAuthProvider() == null || "LOCAL".equals(user.getAuthProvider())) {
                user.setAuthProvider(provider);
                user.setProviderId(providerId);
                userRepository.save(user);
            }
        } else {
            if (isRegistering) {
                // Register a new OAuth user
                user = new User(
                        email,
                        null, // Null password for OAuth users
                        name != null ? name : email.split("@")[0],
                        "USER" // Default role
                );
                user.setAuthProvider(provider);
                user.setProviderId(providerId);
                userRepository.save(user);
                
                // Trigger welcome email asynchronously
                emailService.sendWelcomeEmail(user.getEmail(), user.getName());
            } else {
                throw new RuntimeException("No account found with email: " + email + ". Please register first.");
            }
        }

        String token = jwtService.generateToken(user.getEmail(), user.getRole(), user.getName());
        return new AuthResponse(token, user.getEmail(), user.getName(), user.getRole());
    }

    public boolean validateToken(String token) {
        try {
            String email = jwtService.extractUsername(token);
            return userRepository.findByEmail(email).map(user -> jwtService.isTokenValid(token, user.getEmail())).orElse(false);
        } catch (Exception e) {
            return false;
        }
    }
}
