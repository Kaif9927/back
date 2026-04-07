const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const v = require('../controllers/vendorPortalController');

const vendorApi = express.Router();
vendorApi.use(auth.requireAuth, auth.requireVendor);

vendorApi.get('/profile', v.profile);
vendorApi.get('/products', v.listProducts);
vendorApi.post('/products', v.addProduct);
vendorApi.put('/products/:id', v.updateProduct);
vendorApi.delete('/products/:id', v.deleteProduct);
vendorApi.get('/orders', v.listOrdersForVendor);
vendorApi.patch('/orders/:id/status', v.updateOrderStatus);
vendorApi.get('/requests', v.listRequestsForVendor);
vendorApi.patch('/requests/:id', v.updateRequest);
vendorApi.delete('/requests/:id', v.deleteRequest);

router.use('/vendor', vendorApi);

module.exports = router;
