package com.ecommerce.cart.service;

import com.ecommerce.cart.dto.CartItemRequest;
import com.ecommerce.cart.model.Cart;
import com.ecommerce.cart.model.CartItem;
import com.ecommerce.cart.repository.CartRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Optional;

@Service
public class CartService {

    private final CartRepository cartRepository;

    public CartService(CartRepository cartRepository) {
        this.cartRepository = cartRepository;
    }

    public Cart getCart(String userId) {
        return cartRepository.findById(userId)
                .orElseGet(() -> new Cart(userId, new ArrayList<>()));
    }

    public Cart addItemToCart(String userId, CartItemRequest request) {
        Cart cart = getCart(userId);
        
        // Check if item already exists in the cart
        Optional<CartItem> existingItem = cart.getItems().stream()
                .filter(item -> item.getProductId().equals(request.productId()))
                .findFirst();

        if (existingItem.isPresent()) {
            CartItem item = existingItem.get();
            item.setQuantity(item.getQuantity() + request.quantity());
        } else {
            CartItem newItem = new CartItem(
                    request.productId(),
                    request.name(),
                    request.quantity(),
                    request.price()
            );
            cart.getItems().add(newItem);
        }

        return cartRepository.save(cart);
    }

    public Cart removeItemFromCart(String userId, String productId) {
        Cart cart = getCart(userId);
        cart.getItems().removeIf(item -> item.getProductId().equals(productId));
        return cartRepository.save(cart);
    }

    public void clearCart(String userId) {
        cartRepository.deleteById(userId);
    }
}
