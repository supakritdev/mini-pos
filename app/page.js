"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State สำหรับฟอร์มเพิ่มสินค้าใหม่
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: 'ชิ้น',
  });

  // State สำหรับแก้ไขสินค้าแบบ Inline (เก็บ id ของแถวที่กำลังแก้ไข และค่าที่แก้ไข)
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // ดึงข้อมูลสินค้าทั้งหมดเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      alert('เกิดข้อผิดพลาดในการโหลดสินค้า: ' + error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }

  // จัดการการพิมพ์ในฟอร์มเพิ่มสินค้า
  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  // บันทึกสินค้าใหม่ลง Supabase
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!formData.name || formData.price === '' || formData.stock === '') {
      alert('กรุณากรอกข้อมูลชื่อสินค้า ราคา และจำนวนคงเหลือให้ครบถ้วน');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('products').insert([
      {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        price: Number(formData.price),
        stock: parseInt(formData.stock, 10),
        unit: formData.unit.trim() || 'ชิ้น',
      },
    ]);

    if (error) {
      alert('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setFormData({ sku: '', name: '', price: '', stock: '', unit: 'ชิ้น' });
      fetchProducts(); // โหลดรายการใหม่หลังบันทึกสำเร็จ
    }
    setSaving(false);
  }

  // เริ่มโหมดแก้ไขแบบ Inline
  function startEdit(product) {
    setEditingId(product.id);
    setEditFormData({
      sku: product.sku || '',
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit || 'ชิ้น',
    });
  }

  // ยกเลิกการแก้ไข
  function cancelEdit() {
    setEditingId(null);
    setEditFormData({});
  }

  // จัดการการพิมพ์ในช่องแก้ไข Inline
  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  }

  // บันทึกการแก้ไขสินค้าลง Supabase
  async function handleSaveEdit(id) {
    setSaving(true);
    const { error } = await supabase
      .from('products')
      .update({
        sku: editFormData.sku.trim(),
        name: editFormData.name.trim(),
        price: Number(editFormData.price),
        stock: parseInt(editFormData.stock, 10),
        unit: editFormData.unit.trim() || 'ชิ้น',
      })
      .eq('id', id);

    if (error) {
      alert('แก้ไขสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setEditingId(null);
      fetchProducts();
    }
    setSaving(false);
  }

  // ลบสินค้าออกจาก Supabase
  async function handleDelete(id, name) {
    if (!confirm(`ต้องการลบสินค้า "${name}" ใช่หรือไม่?`)) return;

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      alert('ลบสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      fetchProducts();
    }
  }

  return (
    <div>
      {/* ส่วนที่ 1: ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-grid">
            <div className="form-group">
              <label>รหัสสินค้า (SKU)</label>
              <input
                type="text"
                name="sku"
                placeholder="เช่น P001"
                value={formData.sku}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>ชื่อสินค้า *</label>
              <input
                type="text"
                name="name"
                placeholder="เช่น น้ำดื่ม 600 มล."
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>ราคา (บาท) *</label>
              <input
                type="number"
                name="price"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.price}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>คงเหลือ *</label>
              <input
                type="number"
                name="stock"
                min="0"
                placeholder="0"
                value={formData.stock}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>หน่วย</label>
              <input
                type="text"
                name="unit"
                placeholder="เช่น ขวด, ชิ้น, แพ็ค"
                value={formData.unit}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '+ เพิ่มสินค้า'}
          </button>
        </form>
      </div>

      {/* ส่วนที่ 2: ตารางแสดงรายการสินค้า */}
      <div className="card">
        <h2>รายการสินค้าทั้งหมด ({products.length})</h2>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูลสินค้า...</p>
        ) : products.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>ยังไม่มีรายการสินค้าในระบบ</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>ชื่อสินค้า</th>
                  <th className="text-right">ราคา (บาท)</th>
                  <th className="text-right">คงเหลือ</th>
                  <th>หน่วย</th>
                  <th className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isEditing = editingId === product.id;

                  return (
                    <tr key={product.id}>
                      {isEditing ? (
                        /* โหมดแก้ไขข้อมูลในแถว (Inline Edit) */
                        <>
                          <td>
                            <input
                              type="text"
                              name="sku"
                              value={editFormData.sku}
                              onChange={handleEditChange}
                              style={{ width: '100px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              name="name"
                              value={editFormData.name}
                              onChange={handleEditChange}
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              name="price"
                              step="0.01"
                              value={editFormData.price}
                              onChange={handleEditChange}
                              style={{ width: '90px', textAlign: 'right' }}
                            />
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              name="stock"
                              value={editFormData.stock}
                              onChange={handleEditChange}
                              style={{ width: '80px', textAlign: 'right' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              name="unit"
                              value={editFormData.unit}
                              onChange={handleEditChange}
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td className="text-center">
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                                onClick={() => handleSaveEdit(product.id)}
                                disabled={saving}
                              >
                                บันทึก
                              </button>
                              <button
                                type="button"
                                style={{
                                  backgroundColor: '#e2e8f0',
                                  color: '#334155',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.85rem',
                                }}
                                onClick={cancelEdit}
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        /* โหมดแสดงผลปกติ */
                        <>
                          <td>{product.sku || '-'}</td>
                          <td style={{ fontWeight: 500 }}>{product.name}</td>
                          <td className="text-right">
                            {Number(product.price).toLocaleString('th-TH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className="text-right"
                            style={{
                              color: product.stock <= 5 ? 'var(--danger-color)' : 'inherit',
                              fontWeight: product.stock <= 5 ? 600 : 400,
                            }}
                          >
                            {product.stock}
                          </td>
                          <td>{product.unit}</td>
                          <td className="text-center">
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  color: '#0f172a',
                                  border: '1px solid var(--border-color)',
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.85rem',
                                }}
                                onClick={() => startEdit(product)}
                              >
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => handleDelete(product.id, product.name)}
                              >
                                ลบ
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
