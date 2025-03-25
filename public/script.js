var singleMode = true;
var lastScannedCode = null;
var lastScannedTime = 0;
const debounceTime = 2000; // 2 seconds debounce
var scannedProducts = [];
var inventoryProducts = [];
var filteredByCategoryInventoryProducts = [];
var orders = [];
var selectedSection = '';
var isSorted = false;
var isFilteredByCat = false;
var firstInventoryLoad = true;
const beepSound = new Audio("beep.mp3"); // Load beep sound
const errorSound = new Audio("error.mp3"); // Load beep sound

// QR Code Scanner Callback
const qrCodeSuccessCallback = (decodedText, decodedResult) => {
  const currentTime = Date.now();

  // Prevent duplicate scans within the debounce period
  if (decodedText === lastScannedCode && currentTime - lastScannedTime < debounceTime) {
    return;
  }

  if (decodedText === lastScannedCode) {

  }

  lastScannedCode = decodedText;
  lastScannedTime = currentTime;
  checkScannedBarcode(decodedText);

  if (singleMode) {
    // freezeFrame();
    // pauseScanner()
  }
};

// QR Code Scanner Configuration
const config = {
  fps: 10,
  rememberLastUsedCamera: true,
  showTorchButtonIfSupported: true,
  aspectRatio: 0.56,
  facingMode: "environment",
  formatsToSupport: [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93
  ]
};

// Check Camera Permissions
async function checkCameraPermissions() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop()); // Stop stream after checking
    document.getElementById("permissionDenied").style.display = "none";
    document.getElementById("openScanner").style.display = "block";
    document.getElementById("stopScanner").style.display = "none";
    // document.getElementById("scannerSettings").style.display="none";
    // startScanner(); // If permission is granted, start the scanner
  } catch (error) {
    console.warn("Camera permission denied:", error);
    document.getElementById("openScanner").style.display = "none";
    document.getElementById("permissionDenied").style.display = "block";
    document.getElementById("stopScanner").style.display = "none";
    // document.getElementById("scannerSettings").style.display="none";
  }
}

const html5QrCode = new Html5Qrcode("reader");
// Start QR Code Scanner
function startScanner() {
  document.getElementById("openScanner").style.display = "none";
  document.getElementById("loader").style.display = "block";
  document.getElementById("stopScanner").style.display = "block";
  // document.getElementById("scannerSettings").style.display="block";
  document.getElementById("permissionDenied").style.display = "none"; // Hide permission UI

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    qrCodeSuccessCallback
  ).then(() => {
    document.getElementById("loader").style.display = "none";

  }).catch((err) => {
    console.error("QR Code scanning failed:", err);
    document.getElementById("permissionDenied").style.display = "block"; // Show permission request UI
  });
}

function stopScanner() {
  html5QrCode.stop().then(() => {
    document.getElementById("openScanner").style.display = "block";
    document.getElementById("stopScanner").style.display = "none";
    // document.getElementById("scannerSettings").style.display="none";
  }).catch((err) => {
    console.error("Failed to stop QR Code scanner:", err);
  });
}

// Request Camera Permission Again
document.getElementById("requestPermission").addEventListener("click", () => {
  checkCameraPermissions();
});

// Run Camera Permission Check on Page Load
checkCameraPermissions();


async function checkScannedBarcode(barcode) {
  try {
    const response = await fetch("http://localhost:5000/find-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ barcode })
    });

    if (!response.ok) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      AskToAddProduct(barcode);
    } else {
      const product = await response.json();

      const productIndex = scannedProducts.findIndex(p => p.barcode === barcode);

      if (productIndex != -1) {
        if (scannedProducts[productIndex].selectedQty == scannedProducts[productIndex].quantity) {
          errorSound.play().catch(error => console.error("Error playing beep:", error));
          alert("Reached maximum quantity for this product.");
          return;
        } else {
          addProductQuantity(barcode);
        }
      } else {
        product.selectedQty = 1;
        product.totalPrice = product.price * product.selectedQty;

        var el = document.createElement('div');
        el.classList.add('product');
        el.setAttribute('data-pid', barcode);
        var ProductToAdd = `
        <div class="left">
          <img id="productImage" src="/uploads/${product.image || 'default.jpg'}" alt="">
        </div>
        <div class="right">
          <div class="info">
            <p class="prodname"><span id="productName">${product.name}</span></p>
            <p><span id="productCurrency">${product.currency}</span> <span id="productPrice">${product.totalPrice}</span></p>
            <!-- <p><strong>Barcode:</strong> <span id="productBarcode"></span></p> -->
          </div>

          <div class="actions">
            <span class="remove"><i class="fa-solid fa-trash-can"></i></span>
            <div>
              <span class="remove confirmRemove"><i class="fa-solid fa-check"></i></span>
              <span class="remove cancelRemove"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <div class="productQuantity">
              <span class="less"><i class="fa-solid fa-minus"></i></span>
              <input type="number" name="prodQty" id="" value="1" min="1" max="100" step="1">
              <span class="more"><i class="fa-solid fa-plus"></i></span>
            </div>
          </div>

        </div>
      `;
        el.innerHTML = ProductToAdd;
        document.getElementById("scannedProducts").prepend(el);


        scannedProducts.push(product);
      }

      typeText(barcode)
      beepSound.play().catch(error => console.error("Error playing beep:", error));

      // Hide error and show product info
      document.getElementById("productInfo").style.display = "block";
      getOrdersCount();
      $('#inputLoader').fadeIn();
      document.getElementById("addNewProduct").style.display = "none";
      document.getElementById("scannerContainer").classList.add('shrink');
      document.getElementById("barcodeForm").style.display = "block";
      document.getElementById("barcodeForm").classList.add('moveup');
    }


  } catch (error) {
    document.getElementById("productInfo").style.display = "none";
    document.getElementById("addNewProduct").style.display = "none";
    document.getElementById("barcodeForm").style.display = "block";

  }
}

function AskToAddProduct(barcode) {
  if (confirm("Product not found. Do you want to add it?")) {
    document.getElementById("productInfo").style.display = "none";
    document.getElementById("addNewProduct").style.display = "block";
    document.getElementById("newProductBarcode").value = barcode;
    document.getElementById("newProductLastRestock").value = formatDate();
    document.getElementById("scannerContainer").classList.add('shrink');
    document.getElementById("barcodeForm").style.display = "none";
  }
}

function formatDate() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0'); // Ensure two digits
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();

  return `Today - ${day}/${month}/${year}`;
}

async function submitNewProduct(event) {
  event.preventDefault(); // Prevent form submission from reloading the page

  // Collect form data
  const formData = new FormData();
  formData.append("barcode", document.getElementById("newProductBarcode").value.trim());
  formData.append("name", document.getElementById("newProductName").value.trim());
  formData.append("price", document.getElementById("newProductPrice").value.trim());
  formData.append("currency", document.getElementById("newProductCurrency").value.trim());
  formData.append("type", document.getElementById("newProductType").value.trim() || "Miscellaneous");
  formData.append("quantity", parseInt(document.getElementById("newProductQuantity").value.trim()));
  formData.append("variation", document.getElementById("newProductVariation").value.trim() || null);

  const fileInput = document.getElementById("newProductImage");
  if (fileInput.files.length > 0) {
    formData.append("image", fileInput.files[0]); // Attach file
  }

  try {
    const response = await fetch("http://localhost:5000/add-product", {
      method: "POST",
      body: formData // No need for Content-Type header; FormData sets it automatically
    });

    if (!response.ok) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      alert("Failed to add product");
    }

    const result = await response.json();
    // alert("Product added successfully!");

    // Reset form after submission
    document.getElementById("addNewProductForm").reset();
    document.getElementById("newProductBarcode").value = formData.get("barcode");
    document.getElementById("newProductCurrency").value = "USD";
    document.getElementById("addNewProduct").style.display = "none";
    document.getElementById("barcodeForm").style.display = "block";

  } catch (error) {
    console.error("Error:", error);
    alert("Error adding product: " + error.message);
  }
}

function closeNewProduct() {
  document.getElementById("addNewProduct").style.display = "none";
  document.getElementById("barcodeForm").style.display = "block";

  if (scannedProducts.length == 0) {
    document.getElementById("barcodeForm").classList.remove("moveup");
    document.getElementById("scannerContainer").classList.remove("shrink");
    document.getElementById("productInfo").style.display = "none";
  } else {
    document.getElementById("barcodeForm").classList.add("moveup");
    document.getElementById("scannerContainer").classList.add("shrink");
    document.getElementById("productInfo").style.display = "block";
  }
}

function typeText(text) {
  let index = 0;
  const inputElement = document.getElementById("barcode");

  const interval = setInterval(() => {
    if (index < text.length) {
      inputElement.value += text[index];
      index++;
    } else {
      clearInterval(interval); // Stop when all characters are added
      setTimeout(() => {
        document.getElementById("barcodeForm").reset();
      }, 500);
    }
  }, 10);
}

// Attach event listener to the form
document.getElementById("addNewProductForm").addEventListener("submit", submitNewProduct);
document.getElementById("addNewProductForm").addEventListener("reset", closeNewProduct);
document.getElementById("barcodeForm").addEventListener("submit", function (e) {
  e.preventDefault();
  checkScannedBarcode(document.getElementById("barcode").value.trim());
  document.getElementById("barcodeForm").reset();
});

function addProductQuantity(barcode) {
  const productIndex = scannedProducts.findIndex(p => p.barcode === barcode);

  if (productIndex != -1) {
    if (scannedProducts[productIndex].selectedQty == scannedProducts[productIndex].quantity) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      alert("Reached maximum quantity for this product.");
    } else {
      scannedProducts[productIndex].selectedQty += 1;
      scannedProducts[productIndex].totalPrice = scannedProducts[productIndex].price * scannedProducts[productIndex].selectedQty;

      let domEl = $(".product[data-pid='" + barcode + "']");
      domEl.find('.productQuantity input').val(scannedProducts[productIndex].selectedQty);
      domEl.find('#productPrice').text(scannedProducts[productIndex].totalPrice);

      domEl.find('.productQuantity input').addClass('highlight')
      domEl.find('#productPrice').addClass('highlight')

      setTimeout(() => {
        domEl.find('.highlight').removeClass('highlight')
      }, 500)
    }
  }
}

function subtractProductQuantity(barcode) {
  const productIndex = scannedProducts.findIndex(p => p.barcode === barcode);

  if (productIndex != -1) {
    if (scannedProducts[productIndex].selectedQty == 1) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      alert("Reached minimum quantity for this product.");
    } else {
      scannedProducts[productIndex].selectedQty -= 1;
      scannedProducts[productIndex].totalPrice = scannedProducts[productIndex].price * scannedProducts[productIndex].selectedQty;

      let domEl = $(".product[data-pid='" + barcode + "']");
      domEl.find('.productQuantity input').val(scannedProducts[productIndex].selectedQty);
      domEl.find('#productPrice').text(scannedProducts[productIndex].totalPrice);

      domEl.find('.productQuantity input').addClass('highlight')
      domEl.find('#productPrice').addClass('highlight')

      setTimeout(() => {
        domEl.find('.highlight').removeClass('highlight')
      }, 500)
    }
  }
}

function addNewProductQuantity() {
  let nowVal = parseInt($('#newProductQuantity').val())
  $('#newProductQuantity').val(nowVal + 1);
}

function subtractNewProductQuantity() {
  let nowVal = parseInt($('#newProductQuantity').val())
  if (nowVal == 1) {
    errorSound.play().catch(error => console.error("Error playing beep:", error));
    alert("Reached minimum quantity.");
  } else {
    $('#newProductQuantity').val(nowVal - 1);
  }

}

function removeProduct(barcode) {
  let el = $(".product[data-pid='" + barcode + "']");
  $(el).find('.actions').addClass('removing');
}

function cancelRemoveProduct(barcode) {
  let el = $(".product[data-pid='" + barcode + "']");
  $(el).find('.actions').removeClass('removing');
}

function confirmRemoveProduct(barcode) {
  const productIndex = scannedProducts.findIndex(p => p.barcode === barcode);

  if (productIndex != -1) {
    scannedProducts.splice(productIndex, 1);
    $(".product[data-pid='" + barcode + "']").slideUp();
    setTimeout(() => {
      $(".product[data-pid='" + barcode + "']").remove();

      if (scannedProducts.length == 0) {
        $("#productInfo").fadeOut(0.3);
        document.getElementById("scannerContainer").classList.remove('shrink');
        document.getElementById("barcodeForm").classList.remove('moveup');

        setTimeout(() => {
          document.getElementById("scannerContainer").classList.remove('shrink');
          document.getElementById("barcodeForm").classList.remove('moveup');
        }, 200);
      }
    }, 500);
  }


}

function deleteProduct(barcode) {
  let el = $("#InventoryProducts .product[data-pid='" + barcode + "']");
  $(el).find('.actions').addClass('removing');
}

function cancelDeleteProduct(barcode) {
  let el = $("#InventoryProducts .product[data-pid='" + barcode + "']");
  $(el).find('.actions').removeClass('removing');
}

function confirmDeleteProduct(barcode) {

  $.ajax({
    url: '/delete-product',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ barcode: barcode }),
    success: function (response) {
      const productIndex = inventoryProducts.findIndex(p => p.barcode === barcode);

      if (productIndex != -1) {
        inventoryProducts.splice(productIndex, 1);
        $("#InventoryProducts .product[data-pid='" + barcode + "']").fadeOut();
        setTimeout(() => {
          $("#InventoryProducts .product[data-pid='" + barcode + "']").remove();
        }, 500);
      }
    },
    error: function (xhr, status, error) {
      console.error(xhr.responseJSON.message); // Error message from the server
    }
  });



}

function deleteProductDetails(barcode) {
  let el = $("#productDetails");
  $(el).find('.productDetailsActions').addClass('removing');
}

function cancelDeleteProductDetails(barcode) {
  let el = $("#productDetails");
  $(el).find('.productDetailsActions').removeClass('removing');
}

function confirmDeleteProductDetails(barcode) {
  $('#loader').fadeIn();
  $.ajax({
    url: '/delete-product',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ barcode: barcode }),
    success: function (response) {
      const productIndex = inventoryProducts.findIndex(p => p.barcode === barcode);

      if (productIndex != -1) {
        inventoryProducts.splice(productIndex, 1);
        $("#InventoryProducts .product[data-pid='" + barcode + "']").fadeOut();
        $("#productDetails #deletedAlert").fadeIn()
        setTimeout(() => {
          $("#InventoryProducts .product[data-pid='" + barcode + "']").remove();
          setTimeout(() => {
            $("#productDetails #deletedAlert").fadeOut()
            closeProductDetails();
          }, 500);
        }, 500);
      }
    },
    error: function (xhr, status, error) {
      console.error(xhr.responseJSON.message); // Error message from the server
    }
  });



}

function deleteOrder(oid) {
  let el = $("#Orders .product[data-oid='" + oid + "']");
  $(el).find('.actions').addClass('removing');
}

function deleteOrderDetails(oid) {
  $('#orderDetails .productDetailsActions').addClass('removing');
}

function cancelDeleteOrder(oid) {
  let el = $("#Orders .product[data-oid='" + oid + "']");
  $(el).find('.actions').removeClass('removing');
}

function cancelDeleteOrderDetails(oid) {
  $('#orderDetails .productDetailsActions').removeClass('removing');
}

function confirmDeleteOrder(oid) {
  $.ajax({
    url: '/delete-order',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ oid: oid }),
    success: function (response) {
      const productIndex = orders.findIndex(p => p._id === oid);

      if (productIndex != -1) {
        orders.splice(productIndex, 1);
        $("#Orders .product[data-oid='" + oid + "']").slideUp();
        setTimeout(() => {
          $("#Orders .product[data-oid='" + oid + "']").remove();
        }, 500);
      }


    },
    error: function (xhr, status, error) {
      console.error(xhr.responseJSON.message); // Error message from the server
    }
  });

}

function confirmDeleteOrderDetails(oid) {
  $('#loader').fadeIn();
  $.ajax({
    url: '/delete-order',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ oid: oid }),
    success: function (response) {
      const productIndex = orders.findIndex(p => p._id === oid);

      if (productIndex != -1) {
        orders.splice(productIndex, 1);
        $("#Orders .product[data-oid='" + oid + "']").fadeOut();
        $("#orderDetails #deletedAlert").fadeIn()
        setTimeout(() => {
          $("#Orders .product[data-oid='" + oid + "']").remove();
          setTimeout(() => {
            $("#orderDetails #deletedAlert").fadeOut()
            closeOrderDetails();
            $('#loader').fadeOut();
          }, 500);
        }, 500);
      }
    },
    error: function (xhr, status, error) {
      console.error(xhr.responseJSON.message); // Error message from the server
    }
  });



}

function showSection(section) {
  switch (section) {
    case 'inventory':
      hideOrders();
      hideScanner();
      hideNotifications();
      hideProfile();

      setTimeout(() => {
        showInventory();
      }, 500);
      break;

    case 'orders':
      hideInventory();
      hideScanner();
      hideNotifications();
      hideProfile();

      setTimeout(() => {
        showOrders();
      }, 500);
      break;

    case 'notifications':
      hideInventory();
      hideOrders();
      hideScanner();
      hideProfile();

      setTimeout(() => {
        showNotifications();
      }, 500);
      break;

    case 'profile':
      hideInventory();
      hideOrders();
      hideScanner();
      hideNotifications();

      setTimeout(() => {
        showProfile();
      }, 500);
      break;

    default:
      hideInventory();
      hideOrders();
      hideProfile();
      hideNotifications();

      setTimeout(() => {
        showScanner();
      }, 500);
      break;
  }
}


function showProductDetails(barcode) {
  closeSearch('inventorySearchEntity')

  $.ajax({
    url: '/find-product',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ barcode: barcode }),
    success: function (response) {
      $('#productDetails').html('');

      var productdetails = `
        <div class="productDetailsImage">
          <img src="/uploads/${response.image || 'default.jpg'}" alt="">
        </div>
        <div class="orderDetailsHead">
          <div class="orderId">
            code-<span>${response.barcode}</span>
          </div>
        </div>

        <div class="orderDetailsInfo">
          <div class="orderName">
            ${response.name}
          </div>

          <div class="orderTotal">
            ${response.currency || 'USD'} ${response.price} 
          </div>

          <div class="orderDate">
            ${response.type}
          </div>

          <div class="productMoreDetails">
            <div>Available quantity <span>${response.quantity}</span></div><br>
            <div>Sold quantity <span>${response.soldQuantity}</span></div><br>
            <div>Variation <span>${response.variation}</span></div><br>
            <div>Last restock <span>${response.lastRestock}</span></div>
          </div>

          <div class="productDetailsActions">
            <button class="productDetailsDelete"><i class="fa-solid fa-trash-can"></i></button>
            <div class="deleteProduct">
                <span class="delete confirmProductDetailsDelete"><i class="fa-solid fa-check"></i></span>
                <span class="delete cancelProductDetailsDelete"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <button class="editProductBtn"><i class="fa-solid fa-edit"></i></button>
          </div>

          <div id="deletedAlert">
            <i class="fa-regular fa-circle-check"></i> Product deleted successfully 
          </div>
        </div>
      `;

      $('#productDetails').html(productdetails);

      $('#productDetails').show();
      $('#InventoryProducts').hide();
      $('.sectionInventory > .sectionTitle .sectionTitleActions').hide();
      $('.sectionInventory >.sectionTitle h2').addClass('inventoryBack').html('<i class="fa-solid fa-arrow-left"></i> Inventory');
    },
    error: function (error) {
      console.error('Error fetching order details:', error);
      alert('Error fetching order details');
    }
  });
}

function showOrderDetails(oid) {
  closeSearch('ordersSearchEntity')
  $.ajax({
    url: '/find-order',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ oid: oid }),
    success: function (response) {
      $('#orderDetails').html('');

      var items = "";

      response.items.forEach(item => {
        const productDiv = document.createElement('div');
        productDiv.classList.add('product');
        // productDiv.setAttribute('data-pid', product.barcode);

        productDiv.innerHTML = `
            <div class="left">
                <img id="productImage" src="/uploads/${item.image || 'default.jpg'}" alt="">
            </div>
            <div class="right">
                <div class="info">
                    <div>
                        <p class="prodname"><span id="productName">${item.name}</span></p>
                    </div>
                    <div class="row">
                      <p class="qtyXprice"><span id="productQuantity">${item.selectedQty || 0}</span> x <span id="productPrice">${item.price}</span> = <span id="totalproductPrice">${item.totalPrice}</span> <span id="currency">${item.currency}</span></p>
                    </div>
                </div>
            </div>
        `;

        items += productDiv.outerHTML;
      })


      var orderdetails = `
        <div class="orderDetailsHead">
          <div class="orderId">
            id-${response._id}
          </div>
        </div>

        <div class="orderDetailsInfo">
          <div class="orderName">
            ${response.name}
          </div>

          <div class="orderTotal">
            ${response.currency || 'USD'} ${response.total} 
          </div>

          <div class="orderDate">
            ${response.date}
          </div>

          <div class="productDetailsActions">
            <button class="productDetailsDelete"><i class="fa-solid fa-trash-can"></i></button>
            <div class="deleteProduct">
              <span class="delete confirmProductDetailsDelete"><i class="fa-solid fa-check"></i></span>
              <span class="delete cancelProductDetailsDelete"><i class="fa-solid fa-xmark"></i></span>
            </div>
          </div>
          <div id="deletedAlert">
            <i class="fa-regular fa-circle-check"></i> Order deleted successfully 
          </div>
        </div>

        

        <div class="orderDetailsBody">
          <span class="orderDetailsItemsToggle"><i class="fa-solid fa-caret-right"></i> Show items</span>
          
          <div class="orderItemsCount">
            ${response.itemsCount} ${response.itemsCount == 1 ? 'item' : 'items'}
          </div>
        </div>
        <div class="orderDetailsProductsList">
          <div id="detailsProdsList" class="products">
            ${items}
          </div>
        </div>

        
      `;



      $('#orderDetails').html(orderdetails);

      $('#orderDetails').show();
      $('#Orders').hide();
      $('.sectionOrders > .sectionTitle h2').addClass('ordersback').html('<i class="fa-solid fa-arrow-left"></i> Orders');
      $('.sectionOrders >.sectionTitle .sectionTitleActions').hide();
    },
    error: function (error) {
      console.error('Error fetching order details:', error);
      alert('Error fetching order details');
    }
  });
}

function showDetailsProductsList() {
  if ($('.orderDetailsItemsToggle').hasClass('open')) {
    $('.orderDetailsItemsToggle').removeClass('open')
    $('.orderDetailsProductsList').slideUp();
  } else {
    $('.orderDetailsItemsToggle').addClass('open')
    $('.orderDetailsProductsList').slideDown();
  }
}

function closeOrderDetails() {
  $('#orderDetails').hide();
  $('#orderDetails').html('');
  $('#Orders').show();
  closeSearch('ordersSearchEntity')
  $('.sectionOrders >.sectionTitle .sectionTitleActions').css('display','flex');
  $('.sectionOrders >.sectionTitle').removeClass('open');
  $('.sectionOrders .sectionTitle h2').removeClass('ordersback').html('Orders');
}

function closeProductDetails() {
  $('#productDetails').hide();
  $('#productDetails').html('');
  $('#InventoryProducts').show();
  
  closeSearch('inventorySearchEntity')
  $('.sectionInventory >.sectionTitle .sectionTitleActions').css('display','flex');

  $('.sectionInventory >.sectionTitle').removeClass('open');
  $('.sectionInventory >.sectionTitle h2').removeClass('inventoryBack').html('Inventory');
  $('.sectionInventory .sectionTitle .listView').show();
  $('#loader').fadeOut();
}

function hideInventory() {
  $('.sectionInventory').fadeOut();
}
function hideOrders() {
  $('.sectionOrders').fadeOut();
}
function hideScanner() {
  $('.sectionScanner').fadeOut();
}
function hideNotifications() {
  $('.sectionNotifications').fadeOut();
}
function hideProfile() {
  $('.sectionProfile').fadeOut();
}

function showInventory() {
  $('body').addClass('graybody');
  $('.sectionInventory').fadeIn();
  $('#loader').fadeIn();
  closeProductDetails();
  getProducts();
}
function showOrders() {
  $('body').addClass('graybody');
  $('.sectionOrders').fadeIn();
  $('#loader').fadeIn();
  closeOrderDetails();
  getOrders();
}
function showScanner() {
  $('body').removeClass('graybody');
  $('.sectionScanner').fadeIn();
}
function showNotifications() {
  $('body').addClass('graybody');
  $('.sectionNotifications').fadeIn();
}
function showProfile() {
  $('body').addClass('graybody');
  $('.sectionProfile').fadeIn();
}


async function getProducts() {
  try {
    const response = await fetch('/get-products', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      alert(`Error: ${response.status} ${response.statusText}`);
    }

    inventoryProducts = await response.json();

    inventoryProducts = inventoryProducts.filter(x => x.linked)

    if (inventoryProducts.length == 0) {
      $('#InventoryProducts').html('<div class="noProducts"><i class="fa-solid fa-circle-exclamation"></i><span>No products</span></div>');
    } else {
      $('.listView').fadeIn();
      renderInventory(inventoryProducts);
    }

    if (firstInventoryLoad) {
      firstInventoryLoad = false;

      let uniqueTypes = [...new Set(inventoryProducts.map(item => item.type))];
      renderInventoryTypes(uniqueTypes)

    }

    $('#loader').fadeOut();

  } catch (error) {
    $('#InventoryProducts').html(`<div class="noProducts"><i class="fa-solid fa-circle-xmark"></i><span>${error.message}</span></div>`);
    $('.listView').fadeOut();
    $('#loader').fadeOut();
  }
}

function renderInventoryTypes(types) {
  let listContainer = document.querySelector(".categories ul");
  listContainer.innerHTML = "";

  types.forEach(type => {
    let li = document.createElement("li");
    li.textContent = type;
    listContainer.appendChild(li);
  });
}

async function getOrders() {
  try {
    const response = await fetch('/get-orders', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      alert(`Error: ${response.status} ${response.statusText}`);
    }

    orders = await response.json();


    if (orders.filter(x => x.linked).length == 0) {
      $('#Orders').html('<div class="noProducts"><i class="fa-solid fa-circle-exclamation"></i><span>No orders</span></div>');
    } else {
      renderOrders(orders)

    }

    $('#loader').fadeOut();


  } catch (error) {
    $('#Orders').html(`<div class="noProducts"><i class="fa-solid fa-circle-xmark"></i><span>${error.message}</span></div>`);
    $('#loader').fadeOut();
  }
}

async function getOrdersCount() {
  try {
    const response = await fetch('/get-orders', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      errorSound.play().catch(error => console.error("Error playing beep:", error));
      alert(`Error: ${response.status} ${response.statusText}`);
    }

    orders = await response.json();

    $('#inputLoader').fadeOut();

    $("#cartName").val(orders.length + 1)
  } catch (error) {
    $("#cartName").val('null')
  }
}

function openEditProduct(barcode) {

  $('.sectionInventory > .sectionTitle').hide();
  $('#productDetails').hide();

  let productIndex = inventoryProducts.findIndex(p => (p.barcode == barcode));

  if (productIndex !== -1) {
    let product = inventoryProducts[productIndex];

    document.getElementById("editProductId").value = product._id;
    document.getElementById("editProductName").value = product.name;
    document.getElementById("editProductBarcode").value = product.barcode;
    document.getElementById("editProductPrice").value = product.price;
    document.getElementById("editProductCurrency").value = product.currency;
    document.getElementById("editProductType").value = product.type;
    document.getElementById("editProductQuantity").value = product.quantity;
    document.getElementById("editProductVariation").value = product.variation;

    document.getElementById("editProductForm").style.display = "block";
    document.getElementById("InventoryProducts").style.display = "none";
  }


}

function closeEditProduct() {
  document.getElementById("editProductFormForm").reset();
  document.getElementById("editProductForm").style.display = "none";
  document.getElementById("productDetails").style.display = "block";
  $('.sectionInventory .sectionTitle').show();
}

function confirmEditProduct() {
  const updatedProduct = {
    id: document.getElementById("editProductId").value.trim(),
    name: document.getElementById("editProductName").value.trim(),
    barcode: document.getElementById("editProductBarcode").value.trim(),
    price: parseFloat(document.getElementById("editProductPrice").value.trim()),
    currency: document.getElementById("editProductCurrency").value.trim(),
    type: document.getElementById("editProductType").value.trim(),
    quantity: parseInt(document.getElementById("editProductQuantity").value.trim()),
    variation: document.getElementById("editProductVariation").value.trim() || null
  };

  const fileInput = document.getElementById("editProductImage");
  const formData = new FormData();
  Object.keys(updatedProduct).forEach(key => formData.append(key, updatedProduct[key]));
  if (fileInput.files.length > 0) {
    formData.append("image", fileInput.files[0]);
  }

  fetch("http://localhost:5000/edit-product", {
    method: "PUT",
    body: formData
  })
    .then(response => {
      if (!response.ok) {
        errorSound.play().catch(error => console.error("Error playing beep:", error));
        alert("Failed to update product");
      }
    })
    .then(result => {
      closeEditProduct();
      getProducts();
    })
    .catch(error => {
      console.error("Error:", error);
      alert("Error updating product: " + error.message);
    });
}

// Attach event listener to the edit form
document.getElementById("editProductFormForm").addEventListener("submit", function (event) {
  event.preventDefault();
  confirmEditProduct();
});
document.getElementById("editProductFormForm").addEventListener("reset", closeEditProduct);


function showPopup(section) {
  selectedSection = section;

  $('#sortPopup').fadeIn();

  if (selectedSection == 'orders') {
    $('.hideOnOrders').hide()
  }

  $(document).mouseup(function (e) {
    var container = $("#sortPopup .content");

    if (!container.is(e.target) && container.has(e.target).length === 0) {
      hidePopup();
    }
  });
}

function hidePopup() {
  $('#sortPopup').fadeOut();

  $(document).off('mouseup');
  isSorted = false;

  setTimeout(() => {
    $('.hideOnOrders').show()
  }, 500);
}


$(document).ready(function () {
  $(document).on('click', '.categories ul li', function () {
    closeSearch('inventorySearchEntity')


    if ($(this).hasClass('selected')) {
      $(this).removeClass('selected')
      filteredByCategoryInventoryProducts = [];
      renderInventory(inventoryProducts);
      isFilteredByCat = false
      $('.categories ul li').removeClass('selected')
    } else {
      $('.categories ul li').removeClass('selected');
      $(this).addClass('selected')

      // console.log($(this).text().trim())

      filteredByCategoryInventoryProducts = inventoryProducts.filter(p => p.type.includes($(this).text().trim()));

      // console.log(filteredByCategoryInventoryProducts)

      renderInventory(filteredByCategoryInventoryProducts);
      isFilteredByCat = true
    }


    $('.sectionInventory .sectionTitleActions .sort').removeClass('on')

  });

  $(document).on('click', '.more', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    addProductQuantity(barcode)
  });

  $(document).on('click', '.less', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    subtractProductQuantity(barcode)
  });

  $(document).on('click', '.newmore', function () {
    addNewProductQuantity()
  });

  $(document).on('click', '.newless', function () {
    subtractNewProductQuantity(barcode)
  });

  $(document).on('click', '.remove', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    removeProduct(barcode)
  });

  $(document).on('click', '.confirmRemove', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    confirmRemoveProduct(barcode)
  });

  $(document).on('click', '.cancelRemove', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    cancelRemoveProduct(barcode)
  });

  $(document).on('click', '.bottomNav ul li a', function () {
    $('.bottomNav ul li').removeClass('active');
    $(this).parent().addClass('active');
    showSection($(this).parent().attr('data-tag'));
  });

  $(document).on('click', '.listView span', function () {
    $('.listView span').removeClass('active');
    $(this).addClass('active');
    if ($('.listView span.active').attr('data-view') == "list") {
      $('#InventoryProducts').addClass('list');
    } else {
      $('#InventoryProducts').removeClass('list');
    }
  });

  $(document).on('click', '#InventoryProducts .delete', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    deleteProduct(barcode)
  });

  $(document).on('click', '#InventoryProducts .confirmDelete', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    confirmDeleteProduct(barcode)
  });

  $(document).on('click', '#InventoryProducts .cancelDelete', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    cancelDeleteProduct(barcode)
  });

  $(document).on('click', '#InventoryProducts .details', function () {
    barcode = $(this).closest('.product').attr('data-pid');
    showProductDetails(barcode)
  });

  $(document).on('click', '#orderDetails .productDetailsDelete', function () {
    oid = $('#orderDetails .orderId').text().split("-")[1].trim();
    deleteOrderDetails(oid)
  });

  $(document).on('click', '#orderDetails .confirmProductDetailsDelete', function () {
    oid = $('#orderDetails .orderId').text().split("-")[1].trim();
    confirmDeleteOrderDetails(oid)
  });

  $(document).on('click', '#orderDetails .cancelProductDetailsDelete', function () {
    oid = $('#orderDetails .orderId').text().split("-")[1].trim();
    cancelDeleteOrderDetails(oid)
  });

  $(document).on('click', '#productDetails .productDetailsDelete', function () {
    barcode = $('#productDetails .orderDetailsHead .orderId span').text();
    deleteProductDetails(barcode)
  });

  $(document).on('click', '#productDetails .confirmProductDetailsDelete', function () {
    barcode = $('#productDetails .orderDetailsHead .orderId span').text();
    confirmDeleteProductDetails(barcode)
  });

  $(document).on('click', '#productDetails .cancelProductDetailsDelete', function () {
    barcode = $('#productDetails .orderDetailsHead .orderId span').text();
    cancelDeleteProductDetails(barcode)
  });

  $(document).on('click', '#Orders .details', function () {
    oid = $(this).closest('.product').attr('data-oid');
    showOrderDetails(oid)
  });

  $(document).on('click', '#editCartName', function () {
    $('#cartName').removeAttr('disabled');
    $('#cartName').focus();
    $('#editCartName').hide();
    $('#confirmEditCartName').show();
    $('#cancelEditCartName').show();

  });

  $(document).on('click', '#confirmEditCartName', function () {
    $('#cartName').prop('disabled', true);
    $('#cartName').blur();
    $('#editCartName').show();
    $('#confirmEditCartName').hide();
    $('#cancelEditCartName').hide();
  });

  $(document).on('click', '#cancelEditCartName', function () {
    $('#cartName').prop('disabled', true);
    $('#cartName').blur();
    $('#editCartName').show();
    $('#confirmEditCartName').hide();
    $('#cancelEditCartName').hide();
  });

  $(document).on('click', '#clearCart', function () {
    scannedProducts = []; // Reset the array
    $('#productInfo').hide();
    $('#scannerContainer').removeClass('shrink');
    $('#barcodeForm').removeClass('moveup');

    $('#scannedProducts').html('');
  });

  $(document).on('click', '#confirmCart', function () {
    if (scannedProducts.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    const orderData = {
      name: "Cart #" + $('#cartName').val(), // You can customize this
      itemsCount: scannedProducts.length,
      total: scannedProducts.reduce((sum, product) => sum + product.totalPrice, 0),
      items: scannedProducts
    };

    $.ajax({
      url: '/add-order',  // API endpoint
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(orderData),
      success: function (response) {
        console.log("Order created successfully:", response);

        scannedProducts = [];
        $('#productInfo').hide();
        $('#scannedProducts').html('');
        $('#scannerContainer').removeClass('shrink');
        $('#barcodeForm').removeClass('moveup');
      },
      error: function (xhr, status, error) {
        console.error("Error creating order:", error);
        alert("Failed to place the order. Please try again.");
      }
    });


  });

  $(document).on('click', '.ordersback', function () {
    closeOrderDetails();
  });

  $(document).on('click', '.orderDetailsItemsToggle', function () {
    showDetailsProductsList();
  });

  $(document).on('click', '.inventoryBack', function () {
    closeProductDetails();
  });

  $(document).on('click', '.editBack', function () {
    closeEditProduct();
  });

  $(document).on('click', '.editProductBtn', function () {
    var barcode = $('#productDetails .orderDetailsHead .orderId span').text();
    openEditProduct(barcode)
  });

  $(document).on('click', '.sectionInventory .sectionTitleActions .refresh', function () {
    $('#sortPopup .sortingOptions li').removeClass('selected')
    $('#sortPopup .sortingMethod li').removeClass('selected')


    $('#sortPopup .sortingOptions li:eq(0)').addClass('selected')
    $('#sortPopup .sortingMethod li:eq(0)').addClass('selected')
    $('.sectionInventory .sectionTitleActions span').removeClass('on')

    isFilteredByCat = false;
    $('.categories ul li').removeClass('selected')

    showInventory();
  });

  $(document).on('click', '.sectionOrders .sectionTitleActions .refresh', function () {
    $('#sortPopup .sortingOptions li').removeClass('selected')
    $('#sortPopup .sortingMethod li').removeClass('selected')


    $('#sortPopup .sortingOptions li:eq(0)').addClass('selected')
    $('#sortPopup .sortingMethod li:eq(0)').addClass('selected')
    $('.sectionOrders .sectionTitleActions span').removeClass('on')

    showOrders();
  });

  $(document).on('click', '.sectionInventory .sort', function () {
    showPopup('inventory');

  });

  $(document).on('click', '.sectionOrders .sort', function () {
    showPopup('orders');
  });

  $(document).on('click', '.sectionInventory .search', function () {
    search('inventory');
  });

  $(document).on('click', '.sectionOrders .search', function () {
    search('orders');
  });

  $(document).on('click', '#sortPopup .resetbtn', function () {
    if (selectedSection == "orders") {
      $('#sortPopup .sortingOptions li').removeClass('selected')
      $('#sortPopup .sortingMethod li').removeClass('selected')


      $('#sortPopup .sortingOptions li:eq(0)').addClass('selected')
      $('#sortPopup .sortingMethod li:eq(0)').addClass('selected')
      renderOrders(orders)
      $('.sectionOrders .sectionTitleActions .sort').removeClass('on')

    }

    if (selectedSection == "inventory") {
      $('#sortPopup .sortingOptions li').removeClass('selected')
      $('#sortPopup .sortingMethod li').removeClass('selected')


      $('#sortPopup .sortingOptions li:eq(0)').addClass('selected')
      $('#sortPopup .sortingMethod li:eq(0)').addClass('selected')
      if (isFilteredByCat) {
        renderInventory(filteredByCategoryInventoryProducts)
      } else {
        renderInventory(inventoryProducts)
      }
      $('.sectionInventory .sectionTitleActions .sort').removeClass('on')

    }
    hidePopup();
  });

  $(document).on('click', '#sortPopup .sortingOptions li', function () {
    $('#sortPopup .sortingOptions li').removeClass('selected')
    $(this).addClass('selected');
  });

  $(document).on('click', '#sortPopup .sortingMethod li', function () {
    $('#sortPopup .sortingMethod li').removeClass('selected')
    $(this).addClass('selected');
  });

  $(document).on('click', '#sortPopup .applybtn', function () {
    $('#loader').fadeIn();
    let selectedSortOption = $('.sortingOptions .selected').text();
    let selectedSortMethod = $('.sortingMethod .selected').text();

    applySort(selectedSortOption, selectedSortMethod)
  });
});


function applySort(selectedSortOption, selectedSortMethod) {
  isSorted = true;
  if (selectedSection == 'orders') {
    $('.sectionOrders .sectionTitleActions .sort').addClass('on')
    let sortOrder = selectedSortMethod.trim().toLowerCase() === 'ascending' ? 1 : -1;

    if (selectedSortOption == "Name") { selectedSortOption = selectedSortOption.toLowerCase() }
    if (selectedSortOption == "Price") { selectedSortOption = "total" }
    if (selectedSortOption == "Date added") { selectedSortOption = "date" }


    // Create a copy of the original array
    let sortedOrders = [...orders].sort((a, b) => {
      let valueA = a[selectedSortOption];
      let valueB = b[selectedSortOption];

      // Handle different data types
      if (selectedSortOption === 'date') {
        valueA = convertToValidDate(valueA);
        valueB = convertToValidDate(valueB);
      } else if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return -1 * sortOrder;
      if (valueA > valueB) return 1 * sortOrder;
      return 0;
    });

    renderOrders(sortedOrders); // Return the sorted copy
    hidePopup();
    $('#loader').fadeOut();

  }

  if (selectedSection == 'inventory') {
    $('.sectionInventory .sectionTitleActions .sort').addClass('on')
    let sortOrder = selectedSortMethod.trim().toLowerCase() === 'ascending' ? 1 : -1;

    if (selectedSortOption == "Name") { selectedSortOption = selectedSortOption.toLowerCase() }
    if (selectedSortOption == "Price") { selectedSortOption = "total" }
    if (selectedSortOption == "Quantity") { selectedSortOption = "quantity" }
    if (selectedSortOption == "Date added") { selectedSortOption = "date" }

    let sortedInventory = [];

    if (isFilteredByCat) {
      // Create a copy of the original array
      sortedInventory = [...filteredByCategoryInventoryProducts].sort((a, b) => {
        let valueA = a[selectedSortOption];
        let valueB = b[selectedSortOption];

        // Handle different data types
        if (selectedSortOption === 'date') {
          valueA = convertToValidDate(valueA);
          valueB = convertToValidDate(valueB);
        } else if (typeof valueA === 'string') {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }

        if (valueA < valueB) return -1 * sortOrder;
        if (valueA > valueB) return 1 * sortOrder;
        return 0;
      });
    } else {
      // Create a copy of the original array
      sortedInventory = [...inventoryProducts].sort((a, b) => {
        let valueA = a[selectedSortOption];
        let valueB = b[selectedSortOption];

        // Handle different data types
        if (selectedSortOption === 'date') {
          valueA = convertToValidDate(valueA);
          valueB = convertToValidDate(valueB);
        } else if (typeof valueA === 'string') {
          valueA = valueA.toLowerCase();
          valueB = valueB.toLowerCase();
        }

        if (valueA < valueB) return -1 * sortOrder;
        if (valueA > valueB) return 1 * sortOrder;
        return 0;
      });
    }

    renderInventory(sortedInventory); // Return the sorted copy
    hidePopup();
    $('#loader').fadeOut();
  }
}

// Function to convert DD/MM/YYYY to YYYY-MM-DD for correct date sorting
function convertToValidDate(dateStr) {
  let [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day); // Month is zero-based
}

function renderOrders(orders) {
  $('#Orders').html('');

  orders.forEach(order => {
    if (order.linked) {
      const orderDiv = document.createElement('div');
      orderDiv.classList.add('product');
      orderDiv.setAttribute('data-oid', order._id);

      orderDiv.innerHTML = `
            <div class="right">
              <div class="info">
                <div>
                  <p class="prodname"><span id="productName">${order.name}</span></p>
                  <p class="prodDate"><span id="productDate">${order.date}</span></p>
                </div>
                <div class="actions">
                  

                  <button class="details"><i class="fa-solid fa-arrow-right"></i></button>
                </div>
              </div>

            </div>
        `;

      $('#Orders').append(orderDiv);
    }
  });
}

function renderInventory(inventoryProducts) {
  $('#InventoryProducts').html('');

  inventoryProducts.forEach(product => {
    if (product.linked) {
      const productDiv = document.createElement('div');
      productDiv.classList.add('product');
      productDiv.setAttribute('data-pid', product.barcode);

      productDiv.innerHTML = `
            <div class="left">
                <img id="productImage" src="/uploads/${product.image || 'default.jpg'}" alt="">
            </div>
            <div class="right">
                <div class="info">
                    <div>
                        <p class="prodname"><span id="productName">${product.name}</span></p>
                    </div>
                    <div class="row">
                        <p class="prodquantity"><i class="fa-solid fa-cubes"></i><span id="productQuantity">${product.quantity || 0}</span></p>
                        <p class="prodprice"><i class="fa-solid fa-sack-dollar"></i><span id="productCurrency">${product.currency || 'USD'}</span> <span id="productPrice">${product.price}</span></p>
                    </div>
                    <div class="actions">
                        <button class="delete"><i class="fa-solid fa-trash-can"></i></button>
                        <div class="deleteProduct">
                            <span class="delete confirmDelete"><i class="fa-solid fa-check"></i></span>
                            <span class="delete cancelDelete"><i class="fa-solid fa-xmark"></i></span>
                        </div>
                        <button class="details"><i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
            </div>
        `;

      $('#InventoryProducts').append(productDiv);
    }
  });
}

function search(section) {
  if (section == 'orders') {
    $('.sectionOrders .sectionTitle').addClass('open')
    $('.sectionOrders .searchEntity input').focus();


    setTimeout(function () {
      $('.sectionOrders .sectionTitleActions .searchEntity  .searchField').focus();
    }, 500);

    let searchTimeout;

    $('.sectionOrders .searchEntity .searchField').on('input', function () {
      $('.searchloader').fadeIn();
      clearTimeout(searchTimeout);

      searchTimeout = setTimeout(() => {
        let keyword = $(this).val().trim().toLowerCase();

        if (keyword !== "") {
          let ordersSearchResults = orders.filter(o => o.name.toLowerCase().includes(keyword) || o.date.toLowerCase().includes(keyword) || o.total.toString().includes(keyword));


          if (ordersSearchResults.length == 0) {
            $('#Orders').html('<div class="noProducts"><i class="fa-solid fa-circle-exclamation"></i><span>No orders</span></div>');
          } else {
            renderOrders(ordersSearchResults);
          }
        } else {
          renderOrders(orders);
        }
        $('.searchloader').fadeOut();
      }, 300); // Debounce delay (adjust if needed)
    });


    // $(document).mouseup(function (e) {
    //   var container = $(".sectionOrders .sectionTitleActions .searchEntity .content");

    //   if (!container.is(e.target) && container.has(e.target).length === 0) {
    //     closeSearch('ordersSearchEntity');
    //   }
    // });
  }

  if (section == 'inventory') {
    $('.sectionInventory .sectionTitle').addClass('open')
    $('.sectionInventory .searchEntity input').focus();

    $('.categories ul li').removeClass('selected')
    isFilteredByCat = false;

    setTimeout(function () {
      $('.sectionInventory .sectionTitleActions .searchEntity .searchField').focus();
    }, 500);

    let searchTimeout;

    $('.sectionInventory .searchEntity .searchField').on('input', function () {
      $('.searchloader').fadeIn();
      clearTimeout(searchTimeout);

      searchTimeout = setTimeout(() => {
        let keyword = $(this).val().trim().toLowerCase();

        if (keyword !== "") {
          let productsSearchResults = inventoryProducts.filter(p => p.name.toLowerCase().includes(keyword) || p.type.toLowerCase().includes(keyword) || p.quantity.toString().includes(keyword) || p.price.toString().includes(keyword));

          if (productsSearchResults.length == 0) {
            $('#InventoryProducts').html('<div class="noProducts"><i class="fa-solid fa-circle-exclamation"></i><span>No products</span></div>');
          } else {
            renderInventory(productsSearchResults);
          }
        } else {
          renderInventory(inventoryProducts);
        }
        $('.searchloader').fadeOut();
      }, 300); // Debounce delay (adjust if needed)
    });

    // $(document).mouseup(function (e) {
    //   var container = $("#sectionInventory .sectionTitleActions .searchEntity .content");

    //   if (!container.is(e.target) && container.has(e.target).length === 0) {
    //     closeSearch('inventorySearchEntity');
    //   }
    // });
  }
}

function closeSearch(section) {
  if (section == 'ordersSearchEntity') {
    $('.sectionOrders .sectionTitle').removeClass('open')
    $('.sectionOrders .searchEntity .searchField').val('');
    renderOrders(orders)
  }

  if (section == 'inventorySearchEntity') {
    $('.sectionInventory .sectionTitle').removeClass('open')
    $('.sectionInventory .searchEntity .searchField').val('');
    renderInventory(inventoryProducts)
  }

  $(document).off('mouseup');
}