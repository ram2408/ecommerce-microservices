package com.ecommerce.cart.controller;

import com.ecommerce.cart.dto.CartItemRequest;
import com.ecommerce.cart.model.Cart;
import com.ecommerce.cart.service.CartService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<Cart> getCart(@PathVariable String userId) {
        return ResponseEntity.ok(cartService.getCart(userId));
    }

    @PostMapping("/{userId}/add")
    public ResponseEntity<Cart> addItemToCart(
            @PathVariable String userId,
            @RequestBody CartItemRequest request) {
        return ResponseEntity.ok(cartService.addItemToCart(userId, request));
    }

    @PostMapping("/{userId}/remove/{productId}")
    public ResponseEntity<Cart> removeItemFromCart(
            @PathVariable String userId,
            @PathVariable String productId) {
        return ResponseEntity.ok(cartService.removeItemFromCart(userId, productId));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> clearCart(@PathVariable String userId) {
        cartService.clearCart(userId);
        return ResponseEntity.noContent().build();
    }
}
