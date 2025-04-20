const API_URL = "http://localhost:5000"
// const API_URL = "https://posos.onrender.com"
const USDLBP_RATE = 90000;

// var singleMode = true;
var lastScannedCode = null;
var lastScannedTime = 0;
const debounceTime = 2000; // 2 seconds debounce
var scannedProducts = [];
var inventoryProducts = [];
var filteredByCategoryInventoryProducts = [];
var orders = [];
var notifications = [];
var selectedSection = '';
var isSorted = false;
var isFilteredByCat = false;
var firstCamLoad = true;
let scannedProductsQuantityTimeout;
let editProductsQuantityTimeout;
// var firstInventoryLoad = true;
const beepSound = new Audio("beep.mp3"); // Load beep sound
const errorSound = new Audio("error.mp3"); // Load beep sound

// QR Code Scanner Callback
const qrCodeSuccessCallback = (decodedText, decodedResult) => {
  const currentTime = Date.now();

  // Prevent duplicate scans within the debounce period
  if (decodedText === lastScannedCode && currentTime - lastScannedTime < debounceTime) {
    return;
  }

  lastScannedCode = decodedText;
  lastScannedTime = currentTime;

  $('#loader').fadeIn();

  pauseScanner()
  checkScannedBarcode(decodedText);


};

// QR Code Scanner Configuration
const config = {
  fps: 5,
  rememberLastUsedCamera: true,
  showTorchButtonIfSupported: true,
  // aspectRatio: 0.56,
  // aspectRatio: 1.7,
  facingMode: "environment",
  formatsToSupport: [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.AZTEC,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.MAXICODE,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.RSS_14,
    Html5QrcodeSupportedFormats.RSS_EXPANDED,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
  ]
};

// Check Camera Permissions
async function checkCameraPermissions() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop()); // Stop stream after checking
    document.getElementById("permissionDenied").style.display = "none";
    document.getElementById("openScanner").style.display = "block";
    // document.getElementById("scannerSettings").style.display="none";
    // startScanner(); // If permission is granted, start the scanner
  } catch (error) {
    console.warn("Camera permission denied:", error);
    document.getElementById("openScanner").style.display = "none";
    document.getElementById("permissionDenied").style.display = "block";
    // document.getElementById("scannerSettings").style.display="none";
  }
}

const html5QrCode = new Html5Qrcode("reader");
let selectedCameraId = null;
let videoTrack = null;



function startScanner(selectedCameraId = null) {
  document.getElementById("openScanner").style.display = "none";
  document.getElementById("loader").style.display = "block";
  document.getElementById("stopScanner").style.display = "block";
  // document.getElementById("scannerSettings").style.display="block";
  document.getElementById("permissionDenied").style.display = "none"; // Hide permission UI


  const cameraConfig = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: "environment" };

  html5QrCode.start(
    cameraConfig,
    config,
    qrCodeSuccessCallback
  ).then(() => {
    document.getElementById("loader").style.display = "none";

  }).catch((err) => {
    console.error("QR Code scanning failed:", err);
    document.getElementById("permissionDenied").style.display = "block"; // Show permission request UI
  });
}

// function focusCamera() {
//   if (videoTrack) {
//       const capabilities = videoTrack.getCapabilities();
//       if (capabilities.focusMode) {
//           videoTrack.applyConstraints({ advanced: [{ focusMode: "continuous" }] })
//               .then(() => console.log("Focus adjusted"))
//               .catch(err => console.error("Error adjusting focus:", err));
//       }
//   }
// }

function stopScanner() {
  html5QrCode.stop().then(() => {
    document.getElementById("openScanner").style.display = "block";
    document.getElementById("stopScanner").style.display = "none";
    document.getElementById("cameraSelect").style.display = "none";
    // document.getElementById("scannerSettings").style.display="none";
  }).catch((err) => {
    console.error("Failed to stop QR Code scanner:", err);
  });
}

function checkScannedBarcode(barcode, withTypeBarcodeEffect = true) {
  let productIndex = inventoryProducts.findIndex(p => p.barcode == barcode);

  //if product is not found
  if (productIndex == -1) {
    $('#loader').fadeOut();
    errorSound.play().catch(error => console.error("Error playing beep:", error));
    pauseScanner();
    AskToAddProduct(barcode);
  } else {
    let product = inventoryProducts[productIndex];
    scannedproductIndex = scannedProducts.findIndex(p => p.barcode === product.barcode);

    //if product is already in scannedProducts list => add its quantity
    if (scannedproductIndex != -1) {
      if (scannedProducts[scannedproductIndex].selectedQty == scannedProducts[scannedproductIndex].quantity) {
        makeAlert("Reached maximum quantity for this product.");
        resumeScanner();
        $('#loader').fadeOut();
        return;
      } else {
        addProductQuantity(barcode);
      }
    } else {

      //if scanned product's qty is 0 in inventory => don't add
      if (product.quantity == 0) {
        makeAlert(`${product.name} is out of stock. Quantity is ${product.quantity}`)
      } else {
        product.selectedQty = 1;
        product.totalPrice = Number((product.price * product.selectedQty).toFixed(2));

        var el = document.createElement('div');
        el.classList.add('product');
        el.setAttribute('data-pid', barcode);
        var ProductToAdd = `
          <div class="left">
            <img id="productImage" src="${product.image || '/uploads/default.jpg'}" alt="">
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


    }

    if (withTypeBarcodeEffect) {
      typeText(barcode)
    } else {
      document.getElementById("barcodeForm").reset();
    }

    $('#loader').fadeOut();
    beepSound.play().catch(error => console.error("Error playing beep:", error));



    $('#inputLoader').fadeIn();

    if (scannedProducts.length > 0) {
      // Hide error and show product info
      document.getElementById("productInfo").style.display = "block";
      if (scannedProducts.length == 1) {
        getOrdersCount();
      }

      document.getElementById("addNewProduct").style.display = "none";
      document.getElementById("scannerContainer").classList.add('shrink');
      document.getElementById("barcodeForm").style.display = "block";
      document.getElementById("barcodeForm").classList.add('moveup');

    }

    getProducts();
    resumeScanner();
  }
}

function freezeFrame() {
  const videoElement = document.querySelector("video"); // Get the video feed
  const readerElement = document.getElementById("reader");

  if (!videoElement) return;

  // Create canvas only once
  if (!window.canvasElement) {
    window.canvasElement = document.createElement("canvas");
    window.canvasElement.style.position = "absolute";
    window.canvasElement.style.top = "0";
    window.canvasElement.style.left = "0";
    window.canvasElement.style.width = "100%";
    window.canvasElement.style.height = "100%";
    readerElement.appendChild(window.canvasElement);
    window.canvasContext = window.canvasElement.getContext("2d");
  }

  // Set canvas size to match video
  window.canvasElement.width = videoElement.videoWidth;
  window.canvasElement.height = videoElement.videoHeight;

  // Draw the last frame from video onto canvas
  window.canvasContext.drawImage(videoElement, 0, 0, window.canvasElement.width, window.canvasElement.height);

  // Hide video feed and show canvas instead
  videoElement.style.display = "none";
  window.canvasElement.style.display = "block";
}

function pauseScanner() {
  // html5QrCode.stop()
  //   .then(() => console.log("Scanner paused"))
  //   .catch(err => console.error("Error stopping scanner:", err));
  if (html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) {
    html5QrCode.pause()
    console.log("Scanner paused")
  }
}

function resumeScanner() {
  if (html5QrCode.getState() === Html5QrcodeScannerState.PAUSED) {
    html5QrCode.resume();
    console.log("Scanner resummed")
  }
}

function loadCameras() {
  if (firstCamLoad) {
    firstCamLoad = false;
    Html5Qrcode.getCameras().then((cameras) => {
      if (cameras.length > 0) {
        const cameraSelect = document.getElementById("cameraSelect");
        cameraSelect.innerHTML = "";
        const spanElement = document.createElement("span");
        spanElement.innerHTML = '<i class="fa-solid fa-camera"></i>';
        cameraSelect.appendChild(spanElement);

        cameras.forEach(async (camera, index) => {
          const option = document.createElement("li");
          option.setAttribute("data-camid", camera.id);
          option.textContent = index + 1;
          cameraSelect.appendChild(option);
        });

        const backCameras = cameras.filter(camera =>
          /back|rear|environment/i.test(camera.label)
        );
        if (backCameras.length > 0) {
          const bestBackCamera = backCameras[backCameras.length - 1];
          selectedCameraId = bestBackCamera.id
        } else {
          selectedCameraId = cameras[0].id;
        }

        startScanner(selectedCameraId);

        $('#cameraSelect li[data-camid="' + selectedCameraId + '"]').addClass('selected');
        if (cameras.length > 1) {
          document.getElementById("cameraSelect").style.display = "flex";
        }
      }
    }).catch(err => console.error("Error getting cameras:", err));
  } else {
    startScanner(selectedCameraId)
    document.getElementById("cameraSelect").style.display = "flex";

  }

}


// Request Camera Permission Again
document.getElementById("requestPermission").addEventListener("click", () => {
  checkCameraPermissions();
});

// Run Camera Permission Check on Page Load
checkCameraPermissions();

async function AskToAddProduct(barcode) {
  const userConfirmed = await makeAlert("Product not found. Do you want to add it?", "confirm");

  if (userConfirmed) {
    document.getElementById("productInfo").style.display = "none";
    document.getElementById("addNewProduct").style.display = "block";
    document.getElementById("newProductBarcode").value = barcode;
    document.getElementById("newProductLastRestock").value = formatDate();
    document.getElementById("scannerContainer").classList.add('shrink');
    document.getElementById("barcodeForm").style.display = "none";
    document.querySelector('#addNewProductForm .productImg img').src = '/uploads/default.jpg';
    setTimeout(function () {
      $('html, body').animate({
        scrollTop: $('#addNewProduct').offset().top + 50
      }, 300);
    }, 300);

  } else {
    resumeScanner()
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
  formData.append("createdBy", JSON.parse(localStorage.getItem('user')).userInfo.id);

  const fileInput = document.getElementById("newProductImage");
  if (fileInput.files.length > 0) {
    formData.append("image", fileInput.files[0]); // Attach file
  }

  try {
    const response = await fetch(API_URL + "/add-product", {
      method: "POST",
      body: formData // No need for Content-Type header; FormData sets it automatically
    });

    if (!response.ok) {
      makeAlert("Failed to add product");
    }

    const result = await response.json();
    // Reset form after submission
    document.getElementById("addNewProductForm").reset();
    document.getElementById("newProductBarcode").value = formData.get("barcode");
    document.getElementById("newProductCurrency").value = "USD";
    document.getElementById("addNewProduct").style.display = "none";
    document.getElementById("barcodeForm").style.display = "block";
    resumeScanner();
    getProducts();

  } catch (error) {
    console.error("Error:", error);
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

  resumeScanner();
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
  $('#loader').fadeIn();
  checkScannedBarcode(document.getElementById("barcode").value.trim(), false);
  document.getElementById("barcodeForm").reset();
});

function addProductQuantity(barcode) {
  const productIndex = scannedProducts.findIndex(p => p.barcode === barcode);

  if (productIndex != -1) {
    if (scannedProducts[productIndex].selectedQty == scannedProducts[productIndex].quantity) {
      makeAlert("Reached maximum quantity for this product.");
    } else {
      scannedProducts[productIndex].selectedQty += 1;
      scannedProducts[productIndex].totalPrice = Number((scannedProducts[productIndex].price * scannedProducts[productIndex].selectedQty).toFixed(2));

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
      makeAlert("Reached minimum quantity for this product.");
    } else {
      scannedProducts[productIndex].selectedQty -= 1;
      scannedProducts[productIndex].totalPrice = Number((scannedProducts[productIndex].price * scannedProducts[productIndex].selectedQty).toFixed(2));

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
    makeAlert("Reached minimum quantity.");
  } else {
    $('#newProductQuantity').val(nowVal - 1);
  }

}

function addEditProductQuantity() {
  $('#editProductFormForm .productQuantity input').val(parseInt($('#editProductFormForm .productQuantity input').val()) + 1);
}

function subtractEditProductQuantity() {
  if (parseInt($('#editProductFormForm .productQuantity input').val()) > 0) {
    $('#editProductFormForm .productQuantity input').val(parseInt($('#editProductFormForm .productQuantity input').val()) - 1);
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
    url: API_URL + '/unlink-product',
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
    url: API_URL + '/unlink-product',
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
    url: API_URL + '/unlink-order',
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
    url: API_URL + '/unlink-order',
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
      hideLogin();

      setTimeout(() => {
        showInventory();
      }, 500);
      break;

    case 'orders':
      hideInventory();
      hideScanner();
      hideNotifications();
      hideProfile();
      hideLogin();

      setTimeout(() => {
        showOrders();
      }, 500);
      break;

    case 'notifications':
      hideInventory();
      hideOrders();
      hideScanner();
      hideProfile();
      hideLogin();

      setTimeout(() => {
        showNotifications();
      }, 500);
      break;

    case 'profile':
      hideInventory();
      hideOrders();
      hideScanner();
      hideNotifications();
      hideLogin();

      setTimeout(() => {
        showProfile();
      }, 500);
      break;

    case 'login':
      hideInventory();
      hideOrders();
      hideScanner();
      hideNotifications();
      hideProfile();

      setTimeout(() => {
        showLogin();
      }, 500)
      break;

    default:
      hideInventory();
      hideOrders();
      hideProfile();
      hideNotifications();
      hideLogin();

      setTimeout(() => {
        showScanner();
      }, 500);
      break;
  }
}


function showProductDetails(barcode) {
  closeSearch('inventorySearchEntity')

  let response = inventoryProducts.find(p => p.barcode == barcode);

  if (response) {
    $('#productDetails').html('');

    var productdetails = `
        <div class="productDetailsImage">
          <img src="${response.image || '/uploads/default.jpg'}" alt="">
        </div>

        <div class="hotkeys">
          <div class="productDetailsActions">
            <button class="productDetailsDelete"><i class="fa-solid fa-trash-can"></i> Delete</button>
            <div class="deleteProduct">
                <span class="delete confirmProductDetailsDelete"><i class="fa-solid fa-check"></i></span>
                <span class="delete cancelProductDetailsDelete"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <button class="editProductBtn"><i class="fa-solid fa-edit"></i> Edit</button>
            
            <button onclick='openRestock(${JSON.stringify(response)})'><i class="fa-solid fa-warehouse"></i> Restock</button>
          </div>
        </div>

        <!--<div class="orderDetailsHead">
          <div class="orderId">
            code-<span>${response.barcode}</span>
          </div>
        </div>-->

        <div class="orderDetailsInfo">
          <div class="orderName">
            ${response.name}
          </div>

          <div class="orderTotal">
            ${response.currency || 'USD'} ${response.price} 
          </div>

          <div class="orderId">
            code-<span>${response.barcode}</span>
          </div>

          <div class="productMoreDetails">
            <div>Available quantity<span>${response.quantity}</span></div>
            <div>Sold quantity<span>${response.soldQuantity}</span></div>
            <div>Category<span>${response.type}</span></div>
            <div>Variation<span>${response.variation}</span></div>
            <div>Last restock<span>${response.lastRestock}</span></div>
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
    $('.categories').hide();
  } else {
    makeAlert("Product not found");
  }

  $('#loader').fadeOut();
}

function showOrderDetails(oid) {
  closeSearch('ordersSearchEntity')
  $.ajax({
    url: API_URL + '/find-order',
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
          <div>
            <div class="left">
                <img id="productImage" src="${item.image || '/uploads/default.jpg'}" alt="">
            </div>
            <div class="right">
                <div class="info">
                    <div>
                        <p class="prodname"><span id="productName">${item.name}</span></p>
                    </div>
                    <div class="row">
                      <p class="qtyXprice"><span id="productQuantity">${item.selectedQty || 0}</span> x <span id="productPrice">${item.price} ${item.currency}</span></p>
                    </div>
                </div>
            </div>
          </div>

          <div class="total">
            <span id="currency">${item.currency}</span>&nbsp;<span id="totalproductPrice">${item.totalPrice}</span>
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
      makeAlert('Error fetching order details');
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
  $('.sectionOrders >.sectionTitle .sectionTitleActions').css('display', 'flex');
  $('.sectionOrders >.sectionTitle .sectionTitleActions .sort').removeClass('on');

  $('.sectionOrders >.sectionTitle').removeClass('open');
  $('.sectionOrders .sectionTitle h2').removeClass('ordersback').html('Orders');
}

function closeProductDetails() {
  $('#productDetails').hide();
  $('#productDetails').html('');
  $('#InventoryProducts').show();
  $('.categories').show();
  $('.categories ul li').removeClass('selected');

  closeSearch('inventorySearchEntity')
  $('.sectionInventory >.sectionTitle .sectionTitleActions').css('display', 'flex');
  $('.sectionInventory >.sectionTitle .sectionTitleActions .sort').removeClass('on');

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
function hideLogin() {
  $('#accountContainer').fadeOut();
}

function showInventory() {
  $('body').addClass('graybody');
  $('.sectionInventory').fadeIn();
  $('#loader').fadeIn();
  $('.bottomNav').fadeIn();
  closeEditProduct();
  closeProductDetails();
  getProducts();
}

function showOrders() {
  $('body').addClass('graybody');
  $('.sectionOrders').fadeIn();
  $('#loader').fadeIn();
  $('.bottomNav').fadeIn();
  closeOrderDetails();
  getOrders();
}

function showScanner() {
  $('body').removeClass('graybody');
  $('#loader').fadeIn();
  getProducts();
  $('#loader').fadeOut();
  $('.sectionScanner').fadeIn();
  $('.bottomNav').fadeIn();

  if (scannedProducts.length > 0) {
    refreshScannedProducts();
  }
}



function showProfile() {
  $('body').addClass('graybody');
  $('.sectionProfile').fadeIn();
  $('.bottomNav').fadeIn();
  loadProfile();
}

function loadProfile() {
  $('#loader').fadeIn();
  let profile = JSON.parse(localStorage.getItem('user'))
  profile = profile.userInfo;

  let profileName = profile.name || null;
  let profileEmail = profile.email || null;
  let profilePhone = profile.phone || null;
  let profileRole = profile.role;
  let profileEmailIsVerified = profile.emailVerified;
  let profilePhoneIsVerified = profile.phoneVerified;
  let profileAvatar = profile.avatar || 'avatar2.jpg';

  $('.userInfo .info .info').html('');
  $('.userMoreInfo').html('');
  $('.adminActions').html('');

  $('.userInfo .info .info').append(`
    <h2 class="userName">${profileName}</h2>
  `);

  const avatarImg = document.querySelector('.userInfo .avatar img');
  avatarImg.src = profileAvatar;

  avatarImg.onload = function () {
    $('.userMoreInfo').append(`
      <div class="accountField">
        <div class="label">Email</div>
        <div class="field">
          <span class="userEmail">${profileEmail || '<i>not provided</i>'}</span>
        </div>
        ${profileEmail != null && !profileEmailIsVerified ? `<div class="verification" style="display:none;"><a href="javascript:;">Verify email</a></div>` : ``}
      </div>
      <div class="accountField">
        <div class="label">Phone number</div>
        <div class="field">
          <span class="userPhone">${profilePhone || '<i>not provided</i>'}</span>
        </div>
        ${profilePhone != null && !profilePhoneIsVerified ? `<div class="verification" style="display:none;"><a href="javascript:;">Verify phone number</a></div>` : ``}
      </div>
    `);

    if (profileRole == "admin") {
      $('.userInfo .info .info').append(`<div class="badge">Admin</div>`);
      $('.adminActions').append('<button class="secondary" id="clearInventory">Clear Inventory</button>')
      $('.adminActions').append('<button class="secondary" id="clearOrders">Clear Orders</button>')
      $('.adminActions').wrap('<div class="adminControl"></div>')
      $('.adminControl').append(`
        <div id="inventoryClearAlert">
          <i class="fa-regular fa-circle-check"></i> All Products deleted successfully 
        </div>
        <div id="ordersClearAlert">
          <i class="fa-regular fa-circle-check"></i> All orders deleted successfully 
        </div>
      `);

    } else {
      $('.adminActions').hide();
    }

    $('#loader').fadeOut();
  };



}

function showLogin() {
  $('#accountContainer').fadeIn();

  $('.logintabs li a').click(function () {
    $('.logintabs li').removeClass('active');
    $(this).parent().addClass('active');

    if ($(this).text() == "Email") {
      $('#loginPhoneNumber').val('');
      $('#loginPhoneNumber').attr('hidden', true);
      $('#loginEmail').removeAttr('hidden');
      $('#loginEmail').focus();

    }

    if ($(this).text() == "Phone") {
      $('#loginEmail').val('');
      $('#loginEmail').attr('hidden', true);
      $('#loginPhoneNumber').removeAttr('hidden');
      $('#loginPhoneNumber').focus();
    }
  });
}

async function getProducts() {
  try {
    const response = await fetch(API_URL + '/get-products?userId=' + JSON.parse(localStorage.getItem('user')).userInfo.id, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      makeAlert(`Error: ${response.status} ${response.statusText}`);
    }

    inventoryProducts = await response.json();

    inventoryProducts = inventoryProducts.filter(x => x.linked)

    if (inventoryProducts.length == 0) {
      $('#InventoryProducts').html('<div class="noProducts"><i class="fa-solid fa-circle-exclamation"></i><span>No products</span></div>');
    } else {
      $('.listView').fadeIn();
      renderInventory(inventoryProducts);
    }

    // if (firstInventoryLoad) {
    //   firstInventoryLoad = false;

    let uniqueTypes = [...new Set(inventoryProducts.map(item => item.type))];
    renderInventoryTypes(uniqueTypes)

    // }

    //check if scannedproducts is not empty, go through the scanned products, and update their quantities from the inventoryproducts array
    if (scannedProducts.length > 0) {
      const toRemove = [];


      scannedProducts.forEach(scanned => {
        let inventoryItem = inventoryProducts.find(item => item._id === scanned._id);

        if (inventoryItem) {
          scanned.name = inventoryItem.name;
          scanned.price = inventoryItem.price;
          scanned.image = inventoryItem.image;
          scanned.quantity = inventoryItem.quantity;
        } else {
          makeAlert(`Product ${scanned.name} was removed from inventory. Changes will be reflected in cart`)
          toRemove.push(scanned._id);
          $('#scannedProducts .product[data-pid="' + scanned.barcode + '"]').remove();
        }
      });

      scannedProducts = scannedProducts.filter(product => !toRemove.includes(product._id));
    }

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
    const response = await fetch(API_URL + '/get-orders?userId=' + JSON.parse(localStorage.getItem('user')).userInfo.id, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      makeAlert(`Error: ${response.status} ${response.statusText}`);
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
    const response = await fetch(API_URL + '/get-orders?userId=' + JSON.parse(localStorage.getItem('user')).userInfo.id, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      makeAlert(`Error: ${response.status} ${response.statusText}`);
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
    $("#editProductFormForm .productImg img").attr('src', product.image || '/uploads/default.jpg');

    document.getElementById("editProductForm").style.display = "block";
    document.getElementById("InventoryProducts").style.display = "none";
  }


}

function closeEditProduct() {
  document.getElementById("editProductFormForm").reset();
  document.getElementById("restockQtyForm").reset();
  document.getElementById("restockProduct").style.display = "none";
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

  if (document.querySelector('#editProductFormForm .productImg img').src.endsWith("default.jpg")) {
    formData.append("image", "default.jpg");
  }

  fetch(API_URL + "/edit-product", {
    method: "PUT",
    body: formData
  })
    .then(response => {
      if (!response.ok) {
        makeAlert("Failed to update product");
        return Promise.reject("Failed to update product");
      } else {
        return response.json(); // Convert response to JSON
      }
    })
    .then(async updatedProduct => {
      closeEditProduct();
      await getProducts();
      console.log(inventoryProducts)
      showProductDetails(updatedProduct.barcode)
    })
    .catch(error => {
      console.error("Error:", error);
      makeAlert("Error updating product: " + error.message);
    });

}

// Attach event listener to the edit form
document.getElementById("editProductFormForm").addEventListener("submit", function (event) {
  event.preventDefault();
  $('#loader').fadeIn();
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
  getNotifications();

  if (!isUserLoggedIn()) {
    showSection('login');
    $(document).on('submit', '#loginForm', function () {
      $('#loader').fadeIn()
      login();
    });
    $(document).on('submit', '#registerForm', function () {
      $('#loader').fadeIn()
      register();
    });

    $(document).on('click', '.alert .dismissAlert', function () {
      dismissAlert();
    });
    $('#loader').fadeOut();
    return;
  } else {

    showSection('scanner');
    $(document).on('submit', '#loginForm', function () {
      $('#loader').fadeIn()
      login();
    });

    $(document).on('click', '.alert .dismissAlert', function () {
      dismissAlert();
    });
    eventsHandling();
  }

});

function eventsHandling() {
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

  $(document).on('click', '.editmore', function () {
    addEditProductQuantity()
  });

  $(document).on('click', '.editless', function () {
    subtractEditProductQuantity(barcode)
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
    $('#loader').fadeIn();
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
      makeAlert("Your cart is empty!");
    } else {
      openCartDetails();
    }
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
    var barcode = $('#productDetails .orderId span').text();
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

  $(document).on('click', '.sectionNotifications .sectionTitleActions .refresh', function () {
    showNotifications();
  });

  $(document).on('click', '.sectionNotifications .sectionTitleActions .allRead', function () {
    markAllAsRead();
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

  $(document).on('click', '#cameraSelect li', function () {
    if (!$(this).hasClass('selected')) {

      $('#cameraSelect li').removeClass('selected')
      $(this).addClass('selected')
      selectedCameraId = $(this).data('camid')

      // console.log(selectedCameraId)

      html5QrCode.stop().then(() => {
        startScanner(selectedCameraId);
      }).catch(err => console.error("Error switching camera:", err));

    }

  });

  $(document).on('input', '#scannedProducts .product .productQuantity input', function () {
    clearTimeout(scannedProductsQuantityTimeout);

    scannedProductsQuantityTimeout = setTimeout(() => {
      let qty = $(this).val();
      let barcode = $(this).closest('.product').data('pid')

      const productIndex = scannedProducts.findIndex(p => p.barcode == barcode);

      if (productIndex != -1) {

        if (qty > scannedProducts[productIndex].quantity) {
          makeAlert("Reached maximum quantity for this product.");
          $(this).val(scannedProducts[productIndex].selectedQty)
        } else if (qty <= 0) {
          makeAlert("Reached minimum quantity for this product.");
          $(this).val(scannedProducts[productIndex].selectedQty)
        }
        else {
          scannedProducts[productIndex].selectedQty = qty;
          scannedProducts[productIndex].totalPrice = Number((scannedProducts[productIndex].price * scannedProducts[productIndex].selectedQty).toFixed(2));

          $(this).val(scannedProducts[productIndex].selectedQty);
          $(this).closest('.product').find('.right .info #productPrice').text(scannedProducts[productIndex].totalPrice);

          $(this).addClass('highlight')
          $(this).closest('.product').find('.right .info #productPrice').addClass('highlight')

          setTimeout(() => {
            $('.highlight').removeClass('highlight')
          }, 500)
        }
      }

    }, 300);
  });

  $(document).on('input', '#editProductFormForm .productQuantity input', function () {
    clearTimeout(editProductsQuantityTimeout);

    editProductsQuantityTimeout = setTimeout(() => {
      let qty = $(this).val();

      let barcode = $('#editProductBarcode').val();

      const productIndex = inventoryProducts.findIndex(p => p.barcode == barcode);

      if (productIndex != -1) {

        if (qty < 0) {
          makeAlert("Quantity can't be negative.");
          $(this).val(inventoryProducts[productIndex].quantity)
        }

      }

    }, 300);
  });

  $(document).on('click', '#logoutBtn', function () {
    $('#loader').fadeIn();
    logout(JSON.parse(localStorage.getItem('user')).userInfo.id);
  });

  $(document).on('click', '#clearInventory', function () {
    deleteAllProducts();
  });

  $(document).on('click', '#clearOrders', function () {
    deleteAllOrders();
  });

  $(document).on('click', '.profileBack', function () {
    closeProfileEdit()
  });

  $(document).on('reset', '#editProfileForm', function () {
    closeProfileEdit()
  });

  $(document).on('submit', '#editProfileForm', function () {
    updateProfile()
  });

  $(document).on('click', '#changepassword', function () {
    openChangePassword();
  });

  $(document).on('reset', '#changePasswordForm', function () {
    closeChangePassword()
  });

  $(document).on('submit', '#changePasswordForm', function () {
    updatePassword()
  });

  $(document).on('input', '#restockProductQuantity', function () {
    $('#productRestockTotal').text("Total quantity = " + (parseInt($('#productRestockTotal').attr('data-initial')) + parseInt($('#restockProductQuantity').val())))
  });

  $(document).on('reset', '#restockQtyForm', function () {
    closeEditProduct()
  });

  $(document).on('submit', '#restockQtyForm', function (event) {
    event.preventDefault();
    restock();
  });

  document.getElementById('profileAvatarInputField').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        document.querySelector('#editProfileForm .profileAvatar img').src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('editProductImage').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        document.querySelector('#editProductFormForm .productImg img').src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('newProductImage').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        document.querySelector('#addNewProductForm .productImg img').src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });


}

async function openCartDetails() {
  $('#loader').fadeIn();

  const orderData = {
    name: "Cart #" + $('#cartName').val(),
    itemsCount: scannedProducts.length,
    total: scannedProducts.reduce((sum, product) => sum + product.totalPrice, 0),
    items: scannedProducts,
    createdBy: JSON.parse(localStorage.getItem('user')).userInfo.id
  };

  let totalUSD = scannedProducts.reduce((sumusd, product) => sumusd + product.price * product.selectedQty, 0);
  let totalLBP = scannedProducts.reduce((sumlbp, product) => sumlbp + (product.price * product.selectedQty) * USDLBP_RATE, 0);
  let formattedTotalLBP = totalLBP.toLocaleString();


  const userConfirmed = await closeCart(totalUSD, formattedTotalLBP);

  if (userConfirmed) {
    scannedProducts.forEach(async scanned => {
      let inventoryItem = inventoryProducts.find(item => item._id === scanned._id);

      if (inventoryItem) {
        const newQuantity = inventoryItem.quantity - scanned.selectedQty;

        try {
          const res = await fetch('/update-product-quantity', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: scanned._id,
              soldQuantity: scanned.selectedQty
            })
          });

          const data = await res.json();

          if (res.ok) {
            inventoryItem.quantity = newQuantity;
          } else {
            console.error(`Error updating product: ${data.message}`);
          }
        } catch (err) {
          console.error('Error:', err);
        }
      }
    });

    $.ajax({
      url: API_URL + '/add-order',  // API endpoint
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
        $('#loader').fadeOut();
      },
      error: function (xhr, status, error) {
        console.error("Error creating order:", error);
        makeAlert("Failed to place the order.");
        $('#loader').fadeOut();
      }
    });
  } else {
    $('#loader').fadeOut();
  }
}

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
    if (selectedSortOption == "Price") { selectedSortOption = selectedSortOption.toLowerCase() }
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
                  
                  <p class="orderTotal">${order.currency || "USD"} ${order.total}</p>
                  <button class="details"><i class="fa-solid fa-arrow-right"></i></button>
                </div>
              </div>

            </div>
        `;

      $('#Orders').append(orderDiv);
    }
  });
}

async function renderInventory(inventoryProducts) {
  $('#InventoryProducts').html('');

  inventoryProducts.forEach(product => {
    if (product.linked) {
      const productDiv = document.createElement('div');
      productDiv.classList.add('product');
      productDiv.setAttribute('data-pid', product.barcode);

      productDiv.innerHTML = `
            <div class="left">
                <img id="productImage" src="${product.image || '/uploads/default.jpg'}" alt="">
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

    if (product.quantity <= 5) {
      // console.log("will notify")
      notify(product, "Low stock").then(() => {
        // console.log("Notification sent successfully");
      }).catch(err => {
        console.error("Failed to send notification:", err);
      });
    } else {
      foundNotification = notifications.find(n => n.relatedProduct == product._id);

      if (foundNotification) {
        deleteNotification(foundNotification._id)
      }
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

function makeAlert(msg, type = null) {
  return new Promise((resolve, reject) => {
    errorSound.play().catch(error => console.error("Error playing beep:", error));

    if (type === "confirm") {

      $('.alert .actions').prepend('<a class="acceptAlert">Yes</a>');
      $('.alert .actions .dismissAlert').addClass('secondary').text("No");
      $('.alert p').text(msg);
      $('.alert').addClass('show');
      $('.alert .content').addClass('slideup');

      $(document).one('click', '.acceptAlert', function () {
        dismissAlert();
        resolve(true);
      });

      $(document).one('click', '.dismissAlert', function () {
        dismissAlert();
        resolve(false);
      });

    } else {
      $('.alert p').text(msg);
      $('.alert').addClass('show');
      $('.alert .content').addClass('slideup');
      resolve();
    }
  });
}

function closeCart(totalusd, totallbp) {
  return new Promise((resolve, reject) => {
    errorSound.play().catch(error => console.error("Error playing beep:", error));

    $('.closeCart .usd').text(totalusd.toFixed(2) + " USD");
    $('.closeCart .lbp').text(totallbp + " LBP");
    $('.closeCart').addClass('show');
    $('.closeCart .content').addClass('slideup');

    $(document).one('click', '.acceptCloseCart', function () {
      dismissCloseCart();
      resolve(true);
    });

    $(document).one('click', '.dismissCloseCart', function () {
      dismissCloseCart();
      resolve(false);
    });
  });
}

function dismissAlert() {
  $('.alert .content').removeClass('slideup');
  $('.alert').removeClass('show');
  $('.alert .actions .acceptAlert').remove();
  $('.alert .actions .dismissAlert').removeClass('secondary').text("OK");
}

function dismissCloseCart() {
  $('.closeCart .content').removeClass('slideup');
  $('.closeCart').removeClass('show');
}

function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const phoneNumber = document.getElementById("loginPhoneNumber").value.trim();
  const password = document.getElementById("loginpassword").value.trim();

  if ((email == '' && phoneNumber == '') || password == '') {
    makeAlert("Credentials required");
    return;
  } else if (email != '') {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      makeAlert("Invalid email.");
      return;
    }
  }

  const loginData = {
    email: email == '' ? null : email,
    phoneNumber: phoneNumber == '' ? null : phoneNumber,
    password: password
  };

  fetch(API_URL + '/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(loginData)
  })
    .then(async response => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      return response.json();
    })
    .then(data => {
      localStorage.setItem('user', JSON.stringify(data));
      location.reload();
    })
    .catch(error => {
      console.error('Error:', error);
      $('#loader').fadeOut();
      makeAlert(error.message);
    });

}

function logout(id) {
  fetch(API_URL + '/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId: id })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      return response.json();
    })
    .then(data => {
      localStorage.removeItem('user');
      location.reload();
    })
    .catch(error => {
      console.error('Error:', error);
      $('#loader').fadeOut();
      makeAlert('Logout failed. Please try again.');
    });
}

function isUserLoggedIn() {
  if (localStorage.getItem('user')) {
    return true;
  } else {
    return false;
  }
}

function register() {
  const email = document.getElementById("registerEmail").value.trim();
  const phoneNumber = document.getElementById("registerPhoneNumber").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if ((email == '' && phoneNumber == '') || password == '') {
    makeAlert("Credentials required");
    return;
  } else if (email != '') {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      makeAlert("Invalid email.");
      return;
    }
  }

  const registerData = {
    email: email == '' ? null : email,
    phoneNumber: phoneNumber == '' ? null : phoneNumber,
    password: password
  };

  fetch(API_URL + '/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(registerData)
  })
    .then(async response => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      return response.json();
    })
    .then(data => {
      localStorage.setItem('user', JSON.stringify(data));
      $('#loader').fadeOut();
      location.reload();
    })
    .catch(error => {
      console.error('Error:', error);
      $('#loader').fadeOut();
      makeAlert(error.message);
    });
}

async function deleteAllProducts() {
  const userConfirmed = await makeAlert("Are you sure you want to clear the inventory? This action cannot be undone", "confirm");

  if (userConfirmed) {
    $('#loader').fadeIn();

    fetch(API_URL + '/delete-all-products', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user')).token}`
      }
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear inventory');
      }
      return response.json();
    }).then(data => {
      console.log("Inventory cleared successfully:", data);
      $('#inventoryClearAlert').fadeIn();
      setTimeout(function () {
        $('#inventoryClearAlert').fadeOut();
      }, 1000)
      getProducts();
      $('#loader').fadeOut();
    }).catch(error => {
      console.error('Error:', error);
      $('#loader').fadeOut();
      makeAlert(error.message);
    });

  }

}

async function deleteAllOrders() {
  const userConfirmed = await makeAlert("Are you sure you want to delete all orders? This action cannot be undone", "confirm");

  if (userConfirmed) {
    $('#loader').fadeIn();

    fetch(API_URL + '/delete-all-orders', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user')).token}`
      }
    }).then(async response => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete orders');
      }
      return response.json();
    }).then(data => {
      console.log("Orders deleted successfully", data);
      $('#ordersClearAlert').fadeIn();
      setTimeout(function () {
        $('#ordersClearAlert').fadeOut();
      }, 1000)
      getOrders();
      $('#loader').fadeOut();
    }).catch(error => {
      console.error('Error:', error);
      $('#loader').fadeOut();
      makeAlert(error.message);
    });

  }

}

function switchToRegister() {
  $('.loginSection').hide();
  $('.registerSection').show();
}

function switchToLogin() {
  $('.loginSection').show();
  $('.registerSection').hide();
}

function refreshScannedProducts() {
  scannedProducts.forEach(scanned => {

    scanned.totalPrice = Number((scanned.price * scanned.selectedQty).toFixed(2));

    $('#scannedProducts').find('.product[data-pid="' + scanned.barcode + '"]').find('#productName').text(scanned.name)
    $('#scannedProducts').find('.product[data-pid="' + scanned.barcode + '"]').find('.productQuantity input').val(scanned.selectedQty)
    $('#scannedProducts').find('.product[data-pid="' + scanned.barcode + '"]').find('#productPrice').text(scanned.totalPrice)
    $('#scannedProducts').find('.product[data-pid="' + scanned.barcode + '"]').find('#productImage').attr('src', scanned.image == null ? '/uploads/default.jpg' : scanned.image)

    if (scanned.selectedQty > scanned.quantity) {
      makeAlert(`Quantity of ${scanned.name} exceeds stock availability. Selected quantity will be set to maximum available quantity (${scanned.quantity}).`);

      scanned.selectedQty = scanned.quantity;
      scanned.totalPrice = Number((scanned.price * scanned.selectedQty).toFixed(2));

      $('#scannedProducts').find('.product[data-pid="' + scanned.barcode + '"]').find('.productQuantity input').val(scanned.quantity)
      $('#scannedProducts').find('.product[data-pid="' + scanned.barcode + '"]').find('#productPrice').text(scanned.totalPrice)

    }

  });
}

function editProfile() {
  $('.profilediv').hide();
  $('.profileEditdiv').show();

  let profile = JSON.parse(localStorage.getItem('user')).userInfo;

  document.querySelector('#editProfileForm .profileAvatar img').src = profile.avatar || 'avatar2.jpg';
  $('.profileEditdiv #profileNameInputField').val(profile.name);
  $('.profileEditdiv #profileEmailInputField').val(profile.email);
  $('.profileEditdiv #profilePhoneInputField').val(profile.phone);
}

function closeProfileEdit() {
  $('.profilediv').show();
  $('.profileEditdiv').hide();
}

function updateProfile() {
  $('#loader').fadeIn();
  const name = document.getElementById('profileNameInputField').value.trim();
  const email = document.getElementById('profileEmailInputField').value.trim();
  const phone = document.getElementById('profilePhoneInputField').value.trim();
  const avatarFile = document.querySelector('#editProfileForm .profileAvatar img').src.endsWith("avatar2.jpg") ? "avatar2.jpg" : document.getElementById('profileAvatarInputField').files[0];

  if (email == "" && phone == "") {
    makeAlert("Email or phone number required.")
    $('#loader').fadeOut();
    return;
  }

  if (email != "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      makeAlert('Invalid email address.');
      $('#loader').fadeOut();
      return;
    }
  }

  const formData = new FormData();
  const userId = JSON.parse(localStorage.getItem('user')).userInfo.id;

  formData.append("userId", userId);
  formData.append("name", name);
  formData.append("email", email);
  formData.append("phoneNumber", phone);

  if (avatarFile) {
    formData.append("profileAvatar", avatarFile);
  }


  fetch(API_URL + '/edit-profile', {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      if (data.userInfo) {
        localStorage.setItem('user', JSON.stringify(data));
        loadProfile();
        closeProfileEdit();
      } else {
        makeAlert(data.message || 'Update failed.');
        $('#loader').fadeOut();
      }

    })
    .catch(error => {
      console.error('Error:', error);
      makeAlert('An error occurred while updating the profile.');
      $('#loader').fadeOut();
    });
}

function clearAvatar() {
  document.querySelector('#editProfileForm .profileAvatar img').src = "avatar2.jpg";
  $('#profileAvatarInputField').val('');
}

function clearProductImage() {
  document.querySelector('#editProductFormForm .productImg img').src = "/uploads/default.jpg";
  $('#profileAvatarInputField').val('');
}

function clearNewProductImage() {
  document.querySelector('#addNewProductForm .productImg img').src = "/uploads/default.jpg";
  $('#newProductImage').val('');
}

function openChangePassword() {
  $('#editProfileForm').hide();
  $('#changepassword').hide();
  $('.profileEditdiv .sectionTitle').hide();
  $('.newPass').show();
}

function closeChangePassword() {
  $('#editProfileForm').show();
  $('#changepassword').show();
  $('.profileEditdiv .sectionTitle').show();
  $('.newPass').hide();

  $('#profilePasswordField').val('');
  $('#profilePasswordFieldNew').val('');
  $('#profilePasswordFieldRepeat').val('');
}

function updatePassword() {
  $('#loader').fadeIn();

  let currentpass = $('#profilePasswordField').val().trim();
  let newpass = $('#profilePasswordFieldNew').val().trim();
  let repeatpass = $('#profilePasswordFieldRepeat').val().trim();

  if (!currentpass || !newpass || !repeatpass) {
    makeAlert("Please fill in all password fields");
    $('#loader').fadeOut();
    return;
  }

  if (newpass !== repeatpass) {
    makeAlert("New passwords do not match");
    $('#loader').fadeOut();
    return;
  }

  checkCurrentPassword(currentpass).then(isValid => {
    if (isValid) {
      submitNewPassword(newpass);
    } else {
      makeAlert("Wrong current password");
      $('#loader').fadeOut();
    }
  }).catch(() => {
    makeAlert("Error verifying current password");
    $('#loader').fadeOut();
  });
}

function checkCurrentPassword(currentpass) {
  return fetch(API_URL + '/check-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: JSON.parse(localStorage.getItem('user')).userInfo.id,
      currentPassword: currentpass
    })
  })
    .then(res => res.json())
    .then(data => data.valid)
}

function submitNewPassword(newpass) {
  fetch(API_URL + '/update-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: JSON.parse(localStorage.getItem('user')).userInfo.id,
      newPassword: newpass
    })
  })
    .then(res => res.json())
    .then(data => {
      setTimeout(() => {
        $("#passupdatedAlert").fadeOut()
        setTimeout(() => {
          $("#passupdatedAlert").fadeOut()
          closeChangePassword();
          console.log(JSON.stringify(data))
          localStorage.setItem('user', JSON.stringify(data))
          $('#loader').fadeOut();
          loadProfile();
        }, 500);
      }, 500);

    })
    .catch(() => {
      makeAlert("Server error while updating password");
      $('#loader').fadeOut();
    });
}

const processingNotifications = new Set();

async function notify(prod, type) {
  // Prevent duplicate processing for the same product
  if (processingNotifications.has(prod._id)) {
    return;
  }
  processingNotifications.add(prod._id);

  try {
    const existingNotification = notifications.find(n => n.relatedProduct == prod._id);

    if (!existingNotification) {
      const text = `${prod.name} needs to be restocked! Remaining quantity is ${prod.quantity}`;
      const relatedProduct = prod._id;
      const productBarcode = prod.barcode;
      const notificationType = type;
      const createdBy = JSON.parse(localStorage.getItem('user')).userInfo.id;

      const notification = {
        text,
        relatedProduct,
        productBarcode,
        type: notificationType,
        createdBy,
      };

      const res = await fetch(API_URL + '/add-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      if (!res.ok) {
        throw new Error(`Failed to add notification: ${res.statusText}`);
      }

      const data = await res.json();
      getNotifications(); // Refresh notifications
    } else {
      const updatedText = `${prod.name} needs to be restocked! Remaining quantity is ${prod.quantity}`;
      const notificationId = existingNotification._id;

      const res = await fetch(`${API_URL}/edit-notification/${notificationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: updatedText, linked: true }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update notification: ${res.statusText}`);
      }

      const data = await res.json();
      getNotifications(); // Refresh notifications
    }
  } catch (err) {
    console.error("Error in notify():", err);
  } finally {
    // Remove product from processing set
    processingNotifications.delete(prod._id);
  }
}

function deleteNotification(id) {
  fetch(`${API_URL}/edit-notification/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ linked: false }),
  })
    .then(res => res.json())
    .then(data => {
      // console.log("Notification updated:", data);
      getNotifications();
    })
    .catch(err => {
      console.error("Failed to update notification", err);
    });
}

function showNotifications() {
  $('#loader').fadeIn();

  $('body').addClass('graybody');
  $('.sectionNotifications').fadeIn();
  $('.bottomNav').fadeIn();

  getNotifications();



  $('#loader').fadeOut();
}

async function getNotifications() {
  try {
    const response = await fetch(API_URL + '/get-notifications?userId=' + JSON.parse(localStorage.getItem('user')).userInfo.id, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    notifications = await response.json();



    renderNotifications(notifications);
    $('#notificationsCount').show();
    let notread = notifications.filter(n => !n.read).length
    if (notread == 0) {
      $('#notificationsCount').hide()
    } else {
      $('#notificationsCount').show()
      $('#notificationsCount').html(notread);
    }



    // console.log('Notifications ', notifications)

  } catch (error) {
    $('.sectionNotifications .noProducts').remove();
    $('.sectionNotifications').append(`<div class="noProducts"><i class="fa-solid fa-circle-xmark"></i><span>${error.message}</span></div>`);
  }
}

function markNotificationAsRead(id) {

  fetch(API_URL + `/notificationsMarkAsRead/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(res => res.json())
    .then(data => {
      // console.log("Marked as read:", data);
      getNotifications();
    })
    .catch(err => {
      console.error("Failed to mark as read:", err);
    });
}

function markAllAsRead() {

  fetch(API_URL + `/notificationsMarkAsRead/all/${JSON.parse(localStorage.getItem('user')).userInfo.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(res => res.json())
    .then(data => {
      console.log("Marked as read:", data);
      getNotifications();
    })
    .catch(err => {
      console.error("Failed to mark as read:", err);
    });
}

function viewProductDetails(barcode, notificationid) {
  markNotificationAsRead(notificationid)
  hideOrders();
  hideScanner();
  hideNotifications();
  hideProfile();
  hideLogin();
  $('body').addClass('graybody');
  $('.sectionInventory').fadeIn();
  $('#loader').fadeIn();
  $('.bottomNav').fadeIn();
  closeEditProduct();
  closeProductDetails();

  let response = inventoryProducts.find(p => p.barcode == barcode);

  if (response) {
    $('#productDetails').html('');

    var productdetails = `
        <div class="productDetailsImage">
          <img src="${response.image || '/uploads/default.jpg'}" alt="">
        </div>

        <div class="hotkeys">
          <div class="productDetailsActions">
            <button class="productDetailsDelete"><i class="fa-solid fa-trash-can"></i> Delete</button>
            <div class="deleteProduct">
                <span class="delete confirmProductDetailsDelete"><i class="fa-solid fa-check"></i></span>
                <span class="delete cancelProductDetailsDelete"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <button class="editProductBtn"><i class="fa-solid fa-edit"></i> Edit</button>
            
            <button onclick='openRestock(${JSON.stringify(response)})'><i class="fa-solid fa-warehouse"></i> Restock</button>
          </div>
        </div>

        <!--<div class="orderDetailsHead">
          <div class="orderId">
            code-<span>${response.barcode}</span>
          </div>
        </div>-->

        <div class="orderDetailsInfo">
          <div class="orderName">
            ${response.name}
          </div>

          <div class="orderTotal">
            ${response.currency || 'USD'} ${response.price} 
          </div>

          <div class="orderId">
            code-<span>${response.barcode}</span>
          </div>

          <div class="productMoreDetails">
            <div>Available quantity<span>${response.quantity}</span></div>
            <div>Sold quantity<span>${response.soldQuantity}</span></div>
            <div>Category<span>${response.type}</span></div>
            <div>Variation<span>${response.variation}</span></div>
            <div>Last restock<span>${response.lastRestock}</span></div>
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
    $('.categories').hide();

    $('.bottomNav ul li').removeClass('active')
    $('.bottomNav ul li[data-tag="inventory"]').addClass('active')
  } else {
    makeAlert("Product not found");
  }
}

function renderNotifications(notifications) {
  const container = document.getElementById('notifications-container');
  container.innerHTML = '';

  notifications = notifications.filter(n => n.linked == true)

  if (notifications.length == 0) {
    const container = document.getElementById('notifications-container');
    container.innerHTML = '';
    $('.sectionNotifications .noProducts').remove();
    $('.sectionNotifications').append('<div class="noProducts"><i class="fa-solid fa-circle-exclamation"></i><span>No notifications</span></div>');
    $('#notificationsCount').hide();
  } else {
    $('.sectionNotifications .noProducts').remove();

    notifications.forEach(notification => {

      const notifEl = document.createElement('div');
      notifEl.className = 'notification';
      notifEl.innerHTML = `
        
        <p class="title  ${!notification.read ? `shift` : ``}">${notification.type}<span class="date">${formatRelativeTime(notification.date)}</span></p>
        <p class="content">${notification.text}</p>
        ${!notification.read ? `<div class="badge"></div>` : ``}

        <div class="about">

          <div class="actions">
            <a href="javascript:viewProductDetails('${notification.productBarcode}','${notification._id}');">View</a>
            ${!notification.read ? `<a href="javascript:markNotificationAsRead('${notification._id}');">Mark as read</a>` : ''}
          </div>
        </div>
        
        
    `;
      container.appendChild(notifEl);
    });
  }

}

function formatRelativeTime(dateString) {
  const [datePart, timePart] = dateString.split(' ');
  const [day, month, year] = datePart.split('/');
  const [hours, minutes, seconds] = timePart.split(':');

  const inputDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
  const now = new Date();
  const diffMs = now - inputDate;

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "moments ago";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    const options = { weekday: 'long', day: '2-digit', month: 'short' };
    return inputDate.toLocaleDateString(undefined, options);
  } else {
    return datePart; // "15/04/2025"
  }
}

function openRestock(product) {
  $('#productDetails').hide();
  $('.sectionInventory>.sectionTitle').hide();
  $('#restockProduct').show();
  $('#restockProductId').val(product._id)
  $('#productRestockLabel').html(product.name + " restock quantity<span>This quantity will be added to the quantity currently available in stock</span>")
  $('#productRestockTotal').html("Total quantity = " + product.quantity)
  $('#productRestockTotal').attr('data-initial', product.quantity);
  $('#restockProductQuantity').val(0);
  console.log("product", product)
}

async function restock() {
  let productId = $('#restockProductId').val();
  let restockedQuantity =
    parseInt($('#productRestockTotal').attr('data-initial')) +
    parseInt($('#restockProductQuantity').val());

  try {
    const response = await $.ajax({
      url: '/restock-product',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        id: productId,
        restockedQuantity: restockedQuantity
      })
    });

    closeEditProduct();
    await getProducts();
    console.log(inventoryProducts);
    showProductDetails(response.product.barcode);
  } catch (xhr) {
    console.error("Restock failed", xhr.responseJSON?.message || xhr.statusText);
    makeAlert("Failed to restock product");
  }
}