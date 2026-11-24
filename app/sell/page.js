"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setStatusMessage({ type: 'error', text: 'โหลดรายการสินค้าไม่สำเร็จ: ' + error.message });
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }

  function addToCart(product) {
    setStatusMessage({ type: '', text: '' });

    if (product.stock <= 0) {
      setStatusMessage({ type: 'error', text: `สินค้า "${product.name}" หมดสต็อก` });
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        if (currentQty + 1 > product.stock) {
          setStatusMessage({
            type: 'error',
            text: `สินค้า "${product.name}" มีในสต็อกเพียง ${product.stock} ${product.unit}`,
          });
          return prevCart;
        }
        const updatedCart = [...prevCart];
        updatedCart[existingIndex].quantity += 1;
        return updatedCart;
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  }

  function updateCartQuantity(productId, newQty) {
    setStatusMessage({ type: '', text: '' });
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (newQty > item.product.stock) {
            setStatusMessage({
              type: 'error',
              text: `สินค้า "${item.product.name}" มีในสต็อกเพียง ${item.product.stock} ${item.product.unit}`,
            });
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  }

  function removeFromCart(productId) {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  }

  const grandTotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ยิงข้อความผ่าน API Route ฝั่ง Server (/api/telegram) เพื่อความปลอดภัยของ Token
  async function sendTelegramMessage(messageText) {
    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API Route ตอบกลับผิดพลาด:', errorData);
      }
    } catch (error) {
      console.error('ส่งการแจ้งเตือน Telegram ไม่สำเร็จ:', error);
    }
  }

  async function notifyTelegramAfterSale(soldItemsList) {
    const timeFormatted = new Date().toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    for (const item of soldItemsList) {
      const itemTotal = Number(item.product.price) * item.quantity;
      const remainingStock = item.newStock;

      // งานที่ 1: แจ้งเตือน Order เข้า
      const orderMessage =
        `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${item.product.name}\n` +
        `- จำนวน: ${item.quantity} ${item.product.unit || 'ชิ้น'}\n` +
        `- ราคารวม: ${itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${remainingStock} ${item.product.unit || 'ชิ้น'}\n` +
        `- เวลา: ${timeFormatted}`;

      await sendTelegramMessage(orderMessage);

      // งานที่ 2: แจ้งเตือน Stock เหลือน้อย (Stock <= 5)
      if (remainingStock <= 5) {
        const lowStockMessage =
          `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${item.product.name}\n` +
          `- คงเหลือเพียง: ${remainingStock} ${item.product.unit || 'ชิ้น'}\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

        await sendTelegramMessage(lowStockMessage);
      }
    }
  }

  async function handleCheckout() {
    if (cart.length === 0) return;

    setSubmitting(true);
    setStatusMessage({ type: '', text: '' });

    const now = new Date().toISOString();

    const salesRecords = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      total_price: Number(item.product.price) * item.quantity,
      sold_at: now,
    }));

    const { error: saleError } = await supabase.from('sales').insert(salesRecords);

    if (saleError) {
      setStatusMessage({ type: 'error', text: 'บันทึกการขายไม่สำเร็จ: ' + saleError.message });
      setSubmitting(false);
      return;
    }

    const completedItems = [];
    for (const item of cart) {
      const newStock = item.product.stock - item.quantity;
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.product.id);

      if (stockError) {
        setStatusMessage({
          type: 'error',
          text: `บันทึกยอดขายแล้ว แต่ตัดสต็อก "${item.product.name}" ไม่สำเร็จ: ${stockError.message}`,
        });
        setSubmitting(false);
        return;
      }

      completedItems.push({ ...item, newStock });
    }

    await notifyTelegramAfterSale(completedItems);

    setStatusMessage({
      type: 'success',
      text: `ชำระเงินและบันทึกการขายสำเร็จ! (${cart.length} รายการ ยอดรวม ${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)`,
    });
    setCart([]);
    await fetchProducts();
    setSubmitting(false);
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      {/* แถบสรุปยอดเงินรวมขนาดใหญ่ด้านบนสุด */}
      <div
        className="card"
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.75rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.95rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            ยอดชำระสุทธิ ({cart.length} รายการ / {totalItemsCount} ชิ้น)
          </div>
          <div style={{ fontSize: '2.75rem', fontWeight: 800, lineHeight: 1.1, color: '#38bdf8' }}>
            {grandTotal.toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span style={{ fontSize: '1.25rem', fontWeight: 500, color: '#e2e8f0' }}>บาท</span>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCart([]);
              setStatusMessage({ type: '', text: '' });
            }}
            style={{
              backgroundColor: '#334155',
              color: '#f8fafc',
              padding: '0.6rem 1rem',
              fontSize: '0.9rem',
            }}
          >
            ล้างตะกร้าทั้งหมด
          </button>
        )}
      </div>

      {/* กล่องแจ้งเตือนสถานะ */}
      {statusMessage.text && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontWeight: 500,
            backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: statusMessage.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)',
            border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* พื้นที่ทำงานแบ่ง 2 คอลัมน์ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* ฝั่งซ้าย: ค้นหาและกดเลือกสินค้า */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ marginBottom: 0 }}>1. เลือกสินค้า</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>แตะเพื่อเพิ่มลงบิล</span>
          </div>

          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า หรือ SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.6rem 0.85rem' }}
          />

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>กำลังโหลดรายการสินค้า...</p>
          ) : filteredProducts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>ไม่พบสินค้าที่ค้นหา</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                gap: '0.75rem',
                maxHeight: '460px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const inCartItem = cart.find((item) => item.product.id === product.id);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    style={{
                      textAlign: 'left',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: inCartItem
                        ? '2px solid var(--primary-color)'
                        : '1px solid var(--border-color)',
                      backgroundColor: isOutOfStock ? '#f1f5f9' : inCartItem ? '#eff6ff' : '#ffffff',
                      opacity: isOutOfStock ? 0.6 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '105px',
                      position: 'relative',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {product.sku ? `SKU: ${product.sku}` : ''}
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '1rem' }}>
                        {Number(product.price).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: isOutOfStock ? 'var(--danger-color)' : 'var(--text-secondary)',
                        }}
                      >
                        {isOutOfStock ? 'สินค้าหมด' : `เหลือ ${product.stock} ${product.unit}`}
                      </div>
                    </div>

                    {inCartItem && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          backgroundColor: 'var(--primary-color)',
                          color: '#fff',
                          borderRadius: '999px',
                          padding: '0.15rem 0.55rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {inCartItem.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ฝั่งขวา: รายการสินค้าในบิลปัจจุบัน */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>2. รายการในบิลปัจจุบัน</h2>

          {cart.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-secondary)',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)',
              }}
            >
              ยังไม่มีสินค้าในบิล
              <br />
              <span style={{ fontSize: '0.85rem' }}>กรุณาเลือกสินค้าจากรายการด้านซ้าย</span>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: '360px', overflowY: 'auto', marginBottom: '1.25rem' }}>
                {cart.map((item) => {
                  const subtotal = Number(item.product.price) * item.quantity;

                  return (
                    <div
                      key={item.product.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 0',
                        borderBottom: '1px solid var(--border-color)',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {Number(item.product.price).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿ /{' '}
                          {item.product.unit}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          style={{
                            width: '30px',
                            height: '30px',
                            padding: 0,
                            backgroundColor: '#f1f5f9',
                            border: '1px solid var(--border-color)',
                            fontWeight: 700,
                          }}
                        >
                          −
                        </button>
                        <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 600 }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          style={{
                            width: '30px',
                            height: '30px',
                            padding: 0,
                            backgroundColor: '#f1f5f9',
                            border: '1px solid var(--border-color)',
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ minWidth: '85px', textAlign: 'right', fontWeight: 700 }}>
                        {subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        title="ลบรายการ"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--danger-color)',
                          padding: '0.25rem 0.45rem',
                          fontSize: '1rem',
                          fontWeight: 700,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleCheckout}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.95rem',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--success-color)',
                }}
              >
                {submitting
                  ? 'กำลังบันทึกการขาย...'
                  : `ยืนยันการขาย (${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
