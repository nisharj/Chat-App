package com.chat.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class PresenceService {

    private final RedisTemplate<String, String> redisTemplate;

    public void setOnline(String username) {
        redisTemplate.opsForValue().set(
                "presence:" + username, "online", 30, TimeUnit.SECONDS
        );
    }

    public void setOffline(String username) {
        redisTemplate.delete("presence:" + username);
    }

    public boolean isOnline(String username) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("presence:" + username));
    }
}