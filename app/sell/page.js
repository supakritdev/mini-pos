"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // โหลดรายการสินค้าทั้งหมดเมื่อเปิดหน้า
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

  // ค้นหาข้อมูลสินค้าที่ถูกเลือกจาก dropdown
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวมอัตโนมัติ (ราคา x จำนวน)
  const totalPrice = selectedProduct ? Number(selectedProduct.price) * quantity : 0;

  // จัดการเปลี่ยนสินค้าใน dropdown
  function handleProductChange(e) {
    setSelectedProductId(e.target.value);
    setQuantity(1);
    setStatusMessage({ type: '', text: '' });
  }

  // ลดจำนวนสินค้า (ขั้นต่ำ 1)
  function handleDecrease() {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
    setStatusMessage({ type: '', text: '' });
  }

  // เพิ่มจำนวนสินค้า
  function handleIncrease() {
    setQuantity((prev) => prev + 1);
    setStatusMessage({ type: '', text: '' });
  }

  // บันทึกการขายและตัดสต็อก
  async function handleSell(e) {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!selectedProduct) {
      setStatusMessage({ type: 'error', text: 'กรุณาเลือกสินค้าที่ต้องการขาย' });
      return;
    }

    if (quantity <= 0) {
      setStatusMessage({ type: 'error', text: 'จำนวนที่ขายต้องมากกว่า 0' });
      return;
    }

    // 1. ตรวจสอบสต็อกคงเหลือ
    if (quantity > selectedProduct.stock) {
      setStatusMessage({
        type: 'error',
        text: `สินค้า "${selectedProduct.name}" คงเหลือไม่เพียงพอ (เหลือ ${selectedProduct.stock} ${selectedProduct.unit})`,
      });
      return;
    }

    setSubmitting(true);

    // 2. บันทึกรายการลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: quantity,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setStatusMessage({ type: 'error', text: 'บันทึกการขายไม่สำเร็จ: ' + saleError.message });
      setSubmitting(false);
      return;
    }

    // 3. อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - quantity;
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (stockError) {
      setStatusMessage({
        type: 'error',
        text: 'บันทึกยอดขายแล้ว แต่ตัดสต็อกไม่สำเร็จ: ' + stockError.message,
      });
    } else {
      // 4. แสดงข้อความยืนยัน รีเซ็ตฟอร์ม และอัปเดตข้อมูลสินค้าในหน้าเว็บ
      setStatusMessage({
        type: 'success',
        text: `ขาย "${selectedProduct.name}" จำนวน ${quantity} ${selectedProduct.unit} สำเร็จ! (ยอดรวม ${totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)`,
      });
      setSelectedProductId('');
      setQuantity(1);
      await fetchProducts();
    }

    setSubmitting(false);
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div className="card">
        <h2>ขายสินค้า</h2>

        {/* กล่องแจ้งเตือนสถานะ (สำเร็จ / ผิดพลาด) */}
        {statusMessage.text && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              fontSize: '0.95rem',
              backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: statusMessage.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)',
              border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            {/* ส่วนที่ 1: Dropdown เลือกสินค้า */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>เลือกสินค้า *</label>
              <select
                value={selectedProductId}
                onChange={handleProductChange}
                required
                style={{ fontSize: '1rem', padding: '0.6rem 0.75rem' }}
              >
                <option value="">-- กรุณาเลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id} disabled={product.stock <= 0}>
                    {product.name} —{' '}
                    {Number(product.price).toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    บาท (คงเหลือ: {product.stock} {product.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* ส่วนที่ 2: ปุ่มบวกลบจำนวนที่จะขาย */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>จำนวนที่ขาย {selectedProduct ? `(${selectedProduct.unit})` : ''}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleDecrease}
                  disabled={!selectedProduct || quantity <= 1}
                  style={{
                    width: '42px',
                    height: '42px',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid var(--border-color)',
                    padding: 0,
                  }}
                >
                  −
                </button>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQuantity(isNaN(val) || val < 1 ? 1 : val);
                  }}
                  style={{
                    width: '90px',
                    height: '42px',
                    textAlign: 'center',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                  }}
                />

                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={!selectedProduct}
                  style={{
                    width: '42px',
                    height: '42px',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid var(--border-color)',
                    padding: 0,
                  }}
                >
                  +
                </button>

                {selectedProduct && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    คงเหลือในสต็อก: <strong>{selectedProduct.stock}</strong> {selectedProduct.unit}
                  </span>
                )}
              </div>
            </div>

            {/* ส่วนที่ 3: แสดงยอดรวมอัตโนมัติ */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>ยอดรวมสุทธิ</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {totalPrice.toLocaleString('th-TH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                บาท
              </span>
            </div>

            {/* ส่วนที่ 4: ปุ่มยืนยันการขาย */}
            <button
              type="submit"
              className="btn-primary"
              disabled={!selectedProduct || submitting}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem' }}
            >
              {submitting ? 'กำลังบันทึกรายการ...' : 'ขาย'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
