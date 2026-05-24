package com.chat.backend.service;

import com.chat.backend.dto.AuthResponse;
import com.chat.backend.dto.LoginRequest;
import com.chat.backend.dto.RegisterRequest;
import com.chat.backend.exception.ApiException;
import com.chat.backend.model.User;
import com.chat.backend.repository.UserRepository;
import com.chat.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtUtil jwtUtil;

    public AuthResponse register(RegisterRequest request){
        if (request == null) {
            throw ApiException.badRequest("Registration request is required.");
        }

        String username = normalize(request.getUsername());
        String email = normalize(request.getEmail());
        String password = request.getPassword();

        if (username.isBlank()) {
            throw ApiException.badRequest("Username is required.");
        }

        if (email.isBlank()) {
            throw ApiException.badRequest("Email is required.");
        }

        if (password == null || password.isBlank()) {
            throw ApiException.badRequest("Password is required.");
        }

        if(userRepository.existsByEmail(email)){
            throw ApiException.badRequest("Email already in use.");
        }

        if(userRepository.existsByUsername(username)){
            throw ApiException.badRequest("Username already taken.");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail());
        return new AuthResponse(token, user.getUsername(), user.getEmail());
    }

    public AuthResponse login(LoginRequest request){
        if (request == null) {
            throw ApiException.badRequest("Login request is required.");
        }

        String email = normalize(request.getEmail());
        String password = request.getPassword();

        if (email.isBlank() || password == null || password.isBlank()) {
            throw ApiException.badRequest("Email and password are required.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password."));

        if(!passwordEncoder.matches(password, user.getPassword())){
            throw ApiException.unauthorized("Invalid email or password.");
        }

        String token = jwtUtil.generateToken(user.getEmail());
        return new AuthResponse(token, user.getUsername(), user.getEmail());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
