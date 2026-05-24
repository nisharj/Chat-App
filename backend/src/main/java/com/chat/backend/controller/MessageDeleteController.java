package com.chat.backend.controller;

import com.chat.backend.dto.MessageDeleteEvent;
import com.chat.backend.dto.MessageDeleteRequest;
import com.chat.backend.service.MessageDeleteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageDeleteController {

    private final MessageDeleteService deleteService;

    @PostMapping("/delete")
    public MessageDeleteEvent deleteMessages(
            @Valid @RequestBody MessageDeleteRequest request,
            Principal principal
    ) {
        return deleteService.delete(request, principal);
    }
}
