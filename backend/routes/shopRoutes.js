const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const shop = require('../controllers/shopController');

router.get('/shop/vendors', auth.requireAuth, shop.listVendors);
router.get('/shop/vendors/:id', auth.requireAuth, shop.vendorDetail);
router.get('/shop/vendors/:id/products', auth.requireAuth, shop.vendorProducts);

router.get('/shop/cart', auth.requireAuth, auth.requireCustomer, shop.getCart);
router.post('/shop/cart/items', auth.requireAuth, auth.requireCustomer, shop.addCartItem);
router.patch('/shop/cart/items/:productId', auth.requireAuth, auth.requireCustomer, shop.setCartQty);
router.delete('/shop/cart/items/:productId', auth.requireAuth, auth.requireCustomer, shop.removeCartItem);
router.delete('/shop/cart', auth.requireAuth, auth.requireCustomer, shop.clearCart);
router.post('/shop/checkout', auth.requireAuth, auth.requireCustomer, shop.checkout);
router.get('/shop/orders/mine', auth.requireAuth, auth.requireCustomer, shop.myOrders);

router.post('/shop/requests', auth.requireAuth, auth.requireCustomer, shop.createItemRequest);
router.get('/shop/requests/mine', auth.requireAuth, auth.requireCustomer, shop.myItemRequests);

router.get('/shop/guests', auth.requireAuth, auth.requireCustomer, shop.listGuests);
router.post('/shop/guests', auth.requireAuth, auth.requireCustomer, shop.addGuest);
router.delete('/shop/guests/:id', auth.requireAuth, auth.requireCustomer, shop.deleteGuest);

module.exports = router;
