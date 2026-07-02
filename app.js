import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDm1iRXGC0JhD8Cpl94WBy8YkQhuv54zlI",
    authDomain: "laesquinita-75d46.firebaseapp.com",
    projectId: "laesquinita-75d46",
    storageBucket: "laesquinita-75d46.firebasestorage.app",
    messagingSenderId: "247284442980",
    appId: "1:247284442980:web:b2b10dd782fee44c68bc71",
    measurementId: "G-RJ1BESWR2K"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const productsRef = ref(db, 'productos');
const categoriesRef = ref(db, 'categorias');
const turnosRef = ref(db, 'turnos');
const turnoActivoRef = ref(db, 'turnos/activo');
const historialTurnosRef = ref(db, 'historialTurnos');

let currentCategoryId = "todos";
let products = [];
let categories = [];
let searchTerm = "";
let turnoActivo = null; // { id, inicio, ventas: {} }
let ventasTurno = [];

// Elementos DOM
const scanInput = document.getElementById('scanInput');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const categoriesTabs = document.getElementById('categoriesTabs');
const productsContainer = document.getElementById('productsContainer');
const addProductBtn = document.getElementById('addProductBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const resetDBBtn = document.getElementById('resetDBBtn');
const syncStatusSpan = document.getElementById('syncStatus');
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const closeModal = document.getElementById('closeModal');

// Turno UI
const iniciarTurnoBtn = document.getElementById('iniciarTurnoBtn');
const finalizarTurnoBtn = document.getElementById('finalizarTurnoBtn');
const turnoInfo = document.getElementById('turnoInfo');
const turnoInicioSpan = document.getElementById('turnoInicio');
const turnoVentasCountSpan = document.getElementById('turnoVentasCount');
const turnoTotalVentasSpan = document.getElementById('turnoTotalVentas');

// Toast
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden', 'bg-gray-800', 'bg-red-600');
    toast.classList.add(isError ? 'bg-red-600' : 'bg-gray-800');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function toInteger(value, fallback = 0) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? number : fallback;
}

function formatMoney(value) {
    return toNumber(value).toFixed(2);
}

function getProductSalePrice(product) {
    const storedPrice = toNumber(product?.precioTotal, NaN);
    if (Number.isFinite(storedPrice)) return storedPrice;

    const cost = toNumber(product?.precioCosto);
    const profit = toNumber(product?.porcentajeGanancia, 30);
    return toNumber(calculateTotalPrice(cost, profit));
}

function isFallbackCategory(category) {
    return category?.nombre?.trim().toLowerCase() === "otros";
}

async function getOrCreateFallbackCategoryId() {
    const existing = categories.find(isFallbackCategory);
    if (existing) return existing.id;

    const newCatRef = push(categoriesRef);
    await set(newCatRef, { nombre: "Otros" });
    return newCatRef.key;
}

// Precio total
function calculateTotalPrice(cost, percent) {
    const total = toNumber(cost) * (1 + toNumber(percent) / 100);
    return formatMoney(total);
}

function updateTotalPriceField() {
    const cost = parseFloat(document.getElementById('costPrice').value) || 0;
    const percent = parseFloat(document.getElementById('profitPercent').value) || 0;
    document.getElementById('totalPrice').value = calculateTotalPrice(cost, percent);
}

document.getElementById('costPrice')?.addEventListener('input', updateTotalPriceField);
document.getElementById('profitPercent')?.addEventListener('input', updateTotalPriceField);

// ========== GESTIÓN DE TURNOS ==========
function actualizarPanelTurno() {
    if (turnoActivo) {
        iniciarTurnoBtn.classList.add('hidden');
        finalizarTurnoBtn.classList.remove('hidden');
        turnoInfo.classList.remove('hidden');
        const inicio = new Date(turnoActivo.inicio).toLocaleString();
        turnoInicioSpan.textContent = inicio;
        // Calcular total de ventas
        const ventas = turnoActivo.ventas ? Object.values(turnoActivo.ventas) : [];
        const totalVentas = ventas.reduce((sum, v) => sum + toNumber(v.precioTotal), 0);
        const totalCantidad = ventas.reduce((sum, v) => sum + toInteger(v.cantidad, 1), 0);
        turnoVentasCountSpan.textContent = totalCantidad;
        turnoTotalVentasSpan.textContent = formatMoney(totalVentas);
    } else {
        iniciarTurnoBtn.classList.remove('hidden');
        finalizarTurnoBtn.classList.add('hidden');
        turnoInfo.classList.add('hidden');
    }
}

iniciarTurnoBtn.addEventListener('click', async () => {
    const nuevoTurno = {
        inicio: new Date().toISOString(),
        ventas: {}
    };
    try {
        await set(turnoActivoRef, nuevoTurno);
        showToast("Turno iniciado");
    } catch (error) {
        showToast("No se pudo iniciar el turno", true);
        console.error(error);
    }
});

finalizarTurnoBtn.addEventListener('click', async () => {
    if (!turnoActivo) return;
    if (!confirm("¿Finalizar turno? Se guardará en el historial.")) return;
    try {
        // Mover a historial
        const turnoData = { ...turnoActivo, fin: new Date().toISOString() };
        const histRef = push(historialTurnosRef);
        await set(histRef, turnoData);
        // Limpiar turno activo
        await set(turnoActivoRef, null);
        showToast("Turno finalizado y guardado");
    } catch (error) {
        showToast("No se pudo finalizar el turno", true);
        console.error(error);
    }
});

// Escuchar turno activo
onValue(turnoActivoRef, (snap) => {
    turnoActivo = snap.val();
    actualizarPanelTurno();
});

// ========== CARGA INICIAL ==========
async function initialLoad() {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    try {
        const [catsSnap, prodsSnap] = await Promise.race([
            Promise.all([get(categoriesRef), get(productsRef)]),
            timeout
        ]);
        const catsData = catsSnap.val();
        categories = catsData ? Object.entries(catsData).map(([id, cat]) => ({ id, ...cat })) : [];
        if (categories.length === 0) {
            const defaultCats = ["Bebidas", "Vinos", "Limpieza e Higiene", "Galletitas y snacks", "Comestibles", "Helados", "Cigarrillos", "Descartables", "Otros"];
            for (const nombre of defaultCats) {
                const newRef = push(categoriesRef);
                await set(newRef, { nombre });
                categories.push({ id: newRef.key, nombre });
            }
        }
        const prodsData = prodsSnap.val();
        products = prodsData ? Object.entries(prodsData).map(([id, prod]) => ({ id, ...prod })) : [];
        renderCategoriesTabs();
        renderProducts();
        showToast("Inventario cargado", false);
        syncStatusSpan.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i> Actualizado';
        setTimeout(() => {
            syncStatusSpan.innerHTML = '<i class="fas fa-cloud-upload-alt" aria-hidden="true"></i> Sincronizado';
        }, 2000);

        // Suscripciones en tiempo real
        onValue(categoriesRef, (snap) => {
            const data = snap.val();
            categories = data ? Object.entries(data).map(([id, cat]) => ({ id, ...cat })) : [];
            if (categories.length === 0) return;
            renderCategoriesTabs();
            renderProducts();
        });
        onValue(productsRef, (snap) => {
            const data = snap.val();
            products = data ? Object.entries(data).map(([id, prod]) => ({ id, ...prod })) : [];
            renderProducts();
            showToast("Inventario actualizado", false);
            syncStatusSpan.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i> Actualizado';
            setTimeout(() => {
                syncStatusSpan.innerHTML = '<i class="fas fa-cloud-upload-alt" aria-hidden="true"></i> Sincronizado';
            }, 2000);
        });
    } catch (error) {
        console.error('Error al cargar datos:', error);
        productsContainer.innerHTML = `
            <div class="p-8 text-center text-gray-500">
                <i class="fas fa-exclamation-triangle text-3xl mb-4 text-red-500" aria-hidden="true"></i>
                <p class="mb-4">No se pudo conectar con la base de datos.</p>
                <p class="text-sm mb-4">Verificá las reglas de Firebase (deben permitir lectura y escritura).</p>
                <button id="retryLoadBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Reintentar</button>
            </div>
        `;
        document.getElementById('retryLoadBtn')?.addEventListener('click', () => {
            initialLoad();
        });
    }
}

// ========== RENDERIZADO ==========
function renderCategoriesTabs() {
    if (!categories.length) {
        categoriesTabs.innerHTML = '';
        return;
    }
    categoriesTabs.innerHTML = `
        <button type="button" data-cat="todos" class="category-tab flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-t-lg font-medium ${currentCategoryId === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}">
            Todos
        </button>
        ${categories.map(cat => `
            <div class="category-tab-wrap relative inline-flex flex-shrink-0 items-center">
                <button type="button" data-cat="${escapeAttr(cat.id)}" class="category-tab whitespace-nowrap px-4 py-2 rounded-t-lg font-medium ${currentCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}">
                    ${escapeHtml(cat.nombre)}
                </button>
                <div class="category-actions">
                    <button type="button" data-cat-id="${escapeAttr(cat.id)}" class="edit-cat-btn category-action text-xs bg-gray-400 text-white rounded-full w-5 h-5 flex items-center justify-center" title="Editar categoría" aria-label="Editar categoría ${escapeAttr(cat.nombre)}">
                        <i class="fas fa-pen" aria-hidden="true"></i>
                    </button>
                    <button type="button" data-cat-id="${escapeAttr(cat.id)}" class="delete-cat-btn category-action text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center" title="Eliminar categoría" aria-label="Eliminar categoría ${escapeAttr(cat.nombre)}">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        `).join('')}
        <button id="quickAddCat" type="button" class="ml-2 flex-shrink-0 whitespace-nowrap text-blue-600 hover:text-blue-800"><i class="fas fa-plus-circle" aria-hidden="true"></i> Nueva</button>
    `;

    document.querySelectorAll('.category-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategoryId = btn.dataset.cat;
            renderCategoriesTabs();
            renderProducts();
        });
    });
    document.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const catId = btn.dataset.catId;
            const cat = categories.find(c => c.id === catId);
            const newName = prompt("Editar nombre de categoría:", cat?.nombre || "");
            if (!newName || !newName.trim()) return;

            try {
                await update(ref(db, `categorias/${catId}`), { nombre: newName.trim() });
                showToast("Categoría actualizada");
            } catch (error) {
                showToast("No se pudo actualizar la categoría", true);
                console.error(error);
            }
        });
    });
    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const catId = btn.dataset.catId;
            const category = categories.find(cat => cat.id === catId);
            if (isFallbackCategory(category)) {
                showToast("La categoría 'Otros' no se puede eliminar", true);
                return;
            }

            if (confirm("¿Eliminar categoría? Los productos pasarán a 'Otros'")) {
                try {
                    const otrosId = await getOrCreateFallbackCategoryId();
                    if (otrosId) {
                        const moves = products
                            .filter(prod => prod.categoriaId === catId)
                            .map(prod => update(ref(db, `productos/${prod.id}`), { categoriaId: otrosId }));
                        await Promise.all(moves);
                    }
                    await remove(ref(db, `categorias/${catId}`));
                    showToast("Categoría eliminada");
                } catch (error) {
                    showToast("No se pudo eliminar la categoría", true);
                    console.error(error);
                }
            }
        });
    });
    document.getElementById('quickAddCat')?.addEventListener('click', createCategoryFromPrompt);
}

function renderProducts() {
    let filtered = products;
    if (currentCategoryId !== "todos") {
        filtered = filtered.filter(p => p.categoriaId === currentCategoryId);
    }
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (filtered.length === 0) {
        productsContainer.innerHTML = `<div class="p-8 text-center text-gray-500"><i class="fas fa-box-open" aria-hidden="true"></i> No hay productos.</div>`;
        return;
    }

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        productsContainer.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                ${filtered.map(prod => `
                    <div class="card-hover bg-white border rounded-xl shadow-sm p-4 transition-all">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg">${escapeHtml(prod.nombre)}</h3>
                                <p class="text-xs text-gray-500 font-mono">${escapeHtml(prod.codigo || '')}</p>
                                <p class="text-sm mt-1">📅 ${prod.fechaIngreso || ''}</p>
                            </div>
                            <div class="flex gap-1">
                                <button type="button" data-id="${escapeAttr(prod.id)}" class="edit-product-btn text-blue-600" title="Editar producto" aria-label="Editar ${escapeAttr(prod.nombre)}"><i class="fas fa-edit" aria-hidden="true"></i></button>
                                <button type="button" data-id="${escapeAttr(prod.id)}" class="delete-product-btn text-red-600" title="Eliminar producto" aria-label="Eliminar ${escapeAttr(prod.nombre)}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                                <button type="button" data-id="${escapeAttr(prod.id)}" class="sell-product-btn text-green-600" title="Vender producto" aria-label="Vender ${escapeAttr(prod.nombre)}"><i class="fas fa-shopping-cart" aria-hidden="true"></i></button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-3 text-sm">
                            <div><span class="font-semibold">Cant:</span> <span>${prod.cantidad || 0}</span></div>
                            <div><span class="font-semibold">Precio:</span> $${formatMoney(prod.precioCosto)}</div>
                            <div><span class="font-semibold">%Gan:</span> ${prod.porcentajeGanancia || 30}%</div>
                            <div><span class="font-semibold">Total:</span> $${formatMoney(getProductSalePrice(prod))}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        productsContainer.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                            <th class="px-4 py-3 text-left">Nombre</th>
                            <th class="px-4 py-3">Cantidad</th>
                            <th class="px-4 py-3">Costo</th>
                            <th class="px-4 py-3">%Gan</th>
                            <th class="px-4 py-3">Precio Total</th>
                            <th class="px-4 py-3">Fecha ingreso</th>
                            <th class="px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${filtered.map(prod => `
                            <tr>
                                <td class="px-4 py-2 text-sm font-mono">${escapeHtml(prod.codigo || '')}</td>
                                <td class="px-4 py-2 font-medium">${escapeHtml(prod.nombre)}</td>
                                <td class="px-4 py-2">${prod.cantidad || 0}</td>
                                <td class="px-4 py-2">$${formatMoney(prod.precioCosto)}</td>
                                <td class="px-4 py-2">${prod.porcentajeGanancia || 30}%</td>
                                <td class="px-4 py-2 font-semibold">$${formatMoney(getProductSalePrice(prod))}</td>
                                <td class="px-4 py-2 text-sm">${prod.fechaIngreso || ''}</td>
                                <td class="px-4 py-2 flex gap-1">
                                    <button type="button" data-id="${escapeAttr(prod.id)}" class="edit-product-btn text-blue-600" title="Editar producto" aria-label="Editar ${escapeAttr(prod.nombre)}"><i class="fas fa-edit" aria-hidden="true"></i></button>
                                    <button type="button" data-id="${escapeAttr(prod.id)}" class="delete-product-btn text-red-600" title="Eliminar producto" aria-label="Eliminar ${escapeAttr(prod.nombre)}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                                    <button type="button" data-id="${escapeAttr(prod.id)}" class="sell-product-btn text-green-600" title="Vender producto" aria-label="Vender ${escapeAttr(prod.nombre)}"><i class="fas fa-shopping-cart" aria-hidden="true"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Botones de editar/eliminar
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
        btn.addEventListener('click', () => openProductModal(btn.dataset.id));
    });
    document.querySelectorAll('.delete-product-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar producto permanentemente?")) {
                try {
                    await remove(ref(db, `productos/${id}`));
                    showToast("Producto eliminado");
                } catch (error) {
                    showToast("No se pudo eliminar el producto", true);
                    console.error(error);
                }
            }
        });
    });
    // Botón de vender
    document.querySelectorAll('.sell-product-btn').forEach(btn => {
        btn.addEventListener('click', () => venderProducto(btn.dataset.id));
    });
}

// ========== VENDER PRODUCTO ==========
async function venderProducto(productId) {
    if (!turnoActivo) {
        showToast("Debe iniciar un turno antes de vender", true);
        return;
    }
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const stock = toInteger(prod.cantidad, 0);
    if (stock <= 0) {
        showToast("Producto sin stock", true);
        return;
    }
    const cantidad = prompt(`Vender "${prod.nombre}"\nStock actual: ${stock}\nCantidad a vender:`, "1");
    if (cantidad === null) return;

    const cant = toInteger(cantidad, NaN);
    if (!Number.isInteger(cant) || String(cantidad).trim() !== String(cant) || cant <= 0) {
        showToast("Ingresá una cantidad entera válida", true);
        return;
    }
    if (cant > stock) {
        showToast("No hay suficiente stock", true);
        return;
    }
    try {
        // Actualizar stock
        const newStock = stock - cant;
        await update(ref(db, `productos/${productId}`), { cantidad: newStock });
        // Registrar venta en el turno
        const ventaRef = push(ref(db, `turnos/activo/ventas`));
        const precioUnitario = getProductSalePrice(prod);
        const venta = {
            productoId: productId,
            nombre: prod.nombre,
            cantidad: cant,
            precioUnitario,
            precioTotal: toNumber(formatMoney(precioUnitario * cant)),
            timestamp: new Date().toISOString()
        };
        await set(ventaRef, venta);
        showToast(`Vendido: ${cant} x ${prod.nombre}`);
    } catch (error) {
        showToast("Error al registrar venta", true);
        console.error(error);
    }
}

// ========== MODAL PRODUCTO ==========
function openProductModal(id = null) {
    if (!categories.length) {
        showToast("Primero creá una categoría", true);
        return;
    }

    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('productId').value = '';
    modalTitle.innerText = id ? 'Editar Producto' : 'Nuevo Producto';
    const catSelect = document.getElementById('categorySelect');
    catSelect.innerHTML = categories.map(cat => `<option value="${escapeAttr(cat.id)}">${escapeHtml(cat.nombre)}</option>`).join('');
    if (id) {
        const prod = products.find(p => p.id === id);
        if (prod) {
            document.getElementById('productId').value = prod.id;
            document.getElementById('barcode').value = prod.codigo || '';
            document.getElementById('name').value = prod.nombre || '';
            document.getElementById('categorySelect').value = prod.categoriaId || '';
            document.getElementById('entryDate').value = prod.fechaIngreso || '';
            document.getElementById('quantity').value = prod.cantidad || 0;
            document.getElementById('costPrice').value = prod.precioCosto || 0;
            document.getElementById('profitPercent').value = prod.porcentajeGanancia || 30;
        }
    } else {
        if (currentCategoryId !== 'todos' && categories.some(c => c.id === currentCategoryId)) {
            document.getElementById('categorySelect').value = currentCategoryId;
        }
        document.getElementById('entryDate').value = new Date().toISOString().slice(0,10);
    }
    updateTotalPriceField();
    productModal.classList.remove('hidden');
    productModal.classList.add('flex');
    document.getElementById('barcode').focus();
}

function closeProductModal() {
    productModal.classList.add('hidden');
    productModal.classList.remove('flex');
    scanInput.focus();
}

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const codigo = document.getElementById('barcode').value.trim();
    const nombre = document.getElementById('name').value.trim();
    const categoriaId = document.getElementById('categorySelect').value;
    const fechaIngreso = document.getElementById('entryDate').value;
    const cantidad = Math.max(0, toInteger(document.getElementById('quantity').value, 0));
    const precioCosto = Math.max(0, toNumber(document.getElementById('costPrice').value, 0));
    const porcentajeGanancia = Math.max(0, toNumber(document.getElementById('profitPercent').value, 0));
    const precioTotal = toNumber(calculateTotalPrice(precioCosto, porcentajeGanancia));
    const productData = { codigo, nombre, categoriaId, fechaIngreso, cantidad, precioCosto, porcentajeGanancia, precioTotal };

    if (!codigo || !nombre) {
        showToast("Completá código y nombre", true);
        return;
    }

    const duplicate = products.find(prod => prod.codigo === codigo && prod.id !== id);
    if (duplicate && !confirm(`Ya existe un producto con ese código: "${duplicate.nombre}". ¿Guardar igual?`)) {
        return;
    }

    try {
        if (id) {
            await update(ref(db, `productos/${id}`), productData);
            showToast("Producto actualizado");
        } else {
            const newRef = push(productsRef);
            await set(newRef, productData);
            showToast("Producto agregado");
        }
        closeProductModal();
    } catch (error) {
        showToast("No se pudo guardar el producto", true);
        console.error(error);
    }
});

closeModal.addEventListener('click', closeProductModal);
window.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
});

// Escáner (mantiene funcionalidad, pero ahora escanea para vender o editar)
let scanBuffer = "";
let scanTimeout;
scanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const code = scanBuffer.trim();
        if (code) handleScannedBarcode(code);
        scanBuffer = "";
        e.preventDefault();
    } else if (e.key.length === 1) {
        scanBuffer += e.key;
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => { scanBuffer = ""; }, 500);
    }
});

async function handleScannedBarcode(code) {
    const existing = products.find(p => p.codigo === code);
    if (existing) {
        if (turnoActivo) {
            // Vender directamente una unidad
            const stock = toInteger(existing.cantidad, 0);
            if (stock > 0) {
                if (confirm(`Vender 1 unidad de ${existing.nombre}?`)) {
                    try {
                        await update(ref(db, `productos/${existing.id}`), { cantidad: stock - 1 });
                        const ventaRef = push(ref(db, `turnos/activo/ventas`));
                        const precioUnitario = getProductSalePrice(existing);
                        const venta = {
                            productoId: existing.id,
                            nombre: existing.nombre,
                            cantidad: 1,
                            precioUnitario,
                            precioTotal: precioUnitario,
                            timestamp: new Date().toISOString()
                        };
                        await set(ventaRef, venta);
                        showToast(`Vendido: ${existing.nombre}`);
                    } catch (error) {
                        showToast("Error al vender", true);
                        console.error(error);
                    }
                }
            } else {
                showToast("Producto sin stock", true);
            }
        } else {
            // Sin turno, solo editar cantidad
            const newQty = prompt(`Producto encontrado: ${existing.nombre}\nCantidad actual: ${existing.cantidad}\nNueva cantidad (o cancelar):`);
            if (newQty !== null) {
                const parsedQty = toInteger(newQty, NaN);
                if (!Number.isInteger(parsedQty) || String(newQty).trim() !== String(parsedQty) || parsedQty < 0) {
                    showToast("Ingresá una cantidad entera válida", true);
                    return;
                }

                try {
                    await update(ref(db, `productos/${existing.id}`), { cantidad: parsedQty });
                    showToast(`Cantidad actualizada a ${parsedQty}`);
                } catch (error) {
                    showToast("No se pudo actualizar la cantidad", true);
                    console.error(error);
                }
            }
        }
    } else {
        openProductModal();
        document.getElementById('barcode').value = code;
        showToast("Escaneado: complete el formulario", false);
        document.getElementById('name').focus();
    }
    scanInput.value = "";
    if (productModal.classList.contains('hidden')) {
        scanInput.focus();
    }
}

// Buscador
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderProducts();
});
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = "";
    searchTerm = "";
    renderProducts();
});

// Exportar
exportDataBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify({ productos: products, categorias: categories }, null, 2);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_laesquinita_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

addProductBtn.addEventListener('click', () => openProductModal());

async function createCategoryFromPrompt() {
    const newName = prompt("Nombre nueva categoría:");
    if (newName && newName.trim()) {
        const newCatRef = push(categoriesRef);
        try {
            await set(newCatRef, { nombre: newName.trim() });
            showToast("Categoría agregada");
        } catch (error) {
            showToast("No se pudo crear la categoría", true);
            console.error(error);
        }
    }
}

addCategoryBtn.addEventListener('click', createCategoryFromPrompt);

// Reset DB (sin semilla)
resetDBBtn.addEventListener('click', async () => {
    if (!confirm("¿Estás seguro de borrar TODOS los productos y categorías? Esta acción no se puede deshacer.")) return;
    try {
        showToast("⏳ Borrando base de datos...");
        const prodsSnap = await get(productsRef);
        if (prodsSnap.exists()) {
            const updates = {};
            Object.keys(prodsSnap.val()).forEach(key => { updates[`productos/${key}`] = null; });
            await update(ref(db), updates);
        }
        const catsSnap = await get(categoriesRef);
        if (catsSnap.exists()) {
            const updates = {};
            Object.keys(catsSnap.val()).forEach(key => { updates[`categorias/${key}`] = null; });
            await update(ref(db), updates);
        }
        // También borrar turnos
        await set(turnoActivoRef, null);
        showToast("✅ Base de datos vaciada. Recargando...");
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        showToast("❌ Error al resetear", true);
        console.error(error);
    }
});

// Escape HTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m] || m);
}

function escapeAttr(str) {
    return escapeHtml(str);
}

// Inicialización
initialLoad();

// Foco inteligente
scanInput.focus();
document.addEventListener('click', (e) => {
    if (!productModal.classList.contains('hidden')) return;
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
        scanInput.focus();
    }
});
window.addEventListener('resize', () => renderProducts());
