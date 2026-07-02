import { Component, OnInit, inject, signal, viewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseDb } from '../../core/firebase/firebase.client';
import { COLLECTIONS } from '../../core/firebase/collections';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb">
        <span>Dashboard</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Reports</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">Reports & Analytics</h1>
          <p class="page-subtitle">Analyze platform performance, ticket distributions, and revenue.</p>
        </div>
      </div>

      <!-- Overview Cards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom:24px;">
        <div class="card" style="padding:20px;">
          <p class="text-muted text-xs font-semibold uppercase tracking-wider mb-2">Total Sales</p>
          <p class="text-2xl font-bold" style="color:var(--color-primary);">{{ formatCurrency(totalSales()) }}</p>
          <span style="font-size:12px;" class="text-muted">Total platform invoice amount</span>
        </div>
        <div class="card" style="padding:20px;">
          <p class="text-muted text-xs font-semibold uppercase tracking-wider mb-2">Total Tickets Issued</p>
          <p class="text-2xl font-bold">{{ totalTickets() }}</p>
          <span style="font-size:12px;" class="text-muted">Active, used, and checked-in tickets</span>
        </div>
        <div class="card" style="padding:20px;">
          <p class="text-muted text-xs font-semibold uppercase tracking-wider mb-2">Total Registrations</p>
          <p class="text-2xl font-bold">{{ totalUsers() }}</p>
          <span style="font-size:12px;" class="text-muted">Total registered users</span>
        </div>
      </div>

      <!-- Graph Card -->
      <div class="card mb-4">
        <div class="card-header">
          <p class="card-title">Daily Ticket Sales Trend</p>
        </div>
        <div style="height:320px; padding:16px;">
          <canvas #salesChart></canvas>
        </div>
      </div>
    </div>
  `
})
export class Reports implements OnInit, AfterViewInit {
  salesChartRef = viewChild<ElementRef<HTMLCanvasElement>>('salesChart');
  private chart?: Chart;

  totalSales = signal(0);
  totalTickets = signal(0);
  totalUsers = signal(0);

  async ngOnInit(): Promise<void> {
    this.loadReportData();
  }

  ngAfterViewInit(): void {
    this.initChart();
  }

  async loadReportData(): Promise<void> {
    try {
      const [ordersSnap, ticketsSnap, usersSnap] = await Promise.all([
        getDocs(collection(firebaseDb, COLLECTIONS.orders)),
        getDocs(collection(firebaseDb, COLLECTIONS.tickets)),
        getDocs(collection(firebaseDb, COLLECTIONS.users)),
      ]);

      const sales = ordersSnap.docs.reduce((sum, d) => sum + (d.data()['total_amount'] || 0), 0);
      this.totalSales.set(sales);
      this.totalTickets.set(ticketsSnap.size);
      this.totalUsers.set(usersSnap.size);

      // Group orders by date for chart
      const dailySales: Record<string, number> = {};
      ordersSnap.docs.forEach((doc) => {
        const data = doc.data();
        const dateObj = data['order_date']?.toDate() || new Date();
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailySales[label] = (dailySales[label] || 0) + (data['total_amount'] || 0);
      });

      // Sort labels
      const labels = Object.keys(dailySales).slice(-7);
      const data = labels.map((l) => dailySales[l]);

      if (this.chart) {
        this.chart.data.labels = labels.length ? labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        this.chart.data.datasets[0].data = data.length ? data : [120, 230, 180, 430, 310, 480, 520];
        this.chart.update();
      }
    } catch (err) {
      console.error(err);
    }
  }

  initChart(): void {
    const canvas = this.salesChartRef()?.nativeElement;
    if (canvas) {
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Sales ($)',
              data: [120, 230, 180, 430, 310, 480, 520],
              borderColor: '#226CEB',
              backgroundColor: 'rgba(34,108,235,0.08)',
              fill: true,
              tension: 0.3,
              pointBackgroundColor: '#226CEB',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        },
      });
    }
  }

  formatCurrency(val: number): string {
    return '$' + val.toLocaleString();
  }
}
