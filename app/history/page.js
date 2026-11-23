"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // ดึงประวัติการขายทั้งหมดเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchSalesHistory();
  }, []);

  async function fetchSalesHistory() {
    setLoading(true);
    // ดึงข้อมูลจากตาราง sales เรียงตาม sold_at จากล่าสุดไปเก่าสุด
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      alert('เกิดข้อผิดพลาดในการโหลดประวัติการขาย: ' + error.message);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  }

  // คำนวณยอดขายรวมทั้งหมด (Sum ของ total_price)
  const grandTotal = sales.reduce((sum, item) => sum + Number(item.total_price || 0), 0);

  // ฟังก์ชันจัดรูปแบบวันเวลาให้อ่านง่าย (ภาษาไทย)
  function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  return (
    <div>
      {/* ส่วนที่ 1: การ์ดสรุปยอดขายรวมทั้งหมด */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>ยอดขายรวมทั้งหมด</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            จำนวนรายการขายทั้งหมด {sales.length.toLocaleString('th-TH')} รายการ
          </p>
        </div>

        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success-color)' }}>
          {grandTotal.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          บาท
        </div>
      </div>

      {/* ส่วนที่ 2: ตารางแสดงประวัติการขาย */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ marginBottom: 0 }}>ประวัติการขาย</h2>
          <button
            type="button"
            onClick={fetchSalesHistory}
            disabled={loading}
            style={{
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid var(--border-color)',
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
            }}
          >
            {loading ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'}
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>กำลังโหลดประวัติการขาย...</p>
        ) : sales.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>ยังไม่มีประวัติการขายในระบบ</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>วันเวลาที่ขาย</th>
                  <th>ชื่อสินค้า</th>
                  <th className="text-right">จำนวน</th>
                  <th className="text-right">ยอดรวม (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(sale.sold_at)}
                    </td>
                    <td style={{ fontWeight: 500 }}>{sale.product_name}</td>
                    <td className="text-right">{sale.quantity.toLocaleString('th-TH')}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>
                      {Number(sale.total_price).toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
