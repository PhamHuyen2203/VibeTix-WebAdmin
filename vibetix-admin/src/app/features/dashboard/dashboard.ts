import {
  Component,
  inject,
  OnInit,
  signal,
  AfterViewInit,
  ElementRef,
  viewChild,
  effect,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrderDoc } from '../../core/models/order.model';
import { Timestamp } from 'firebase/firestore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, AfterViewInit {
  private dashSvc = inject(DashboardService);

  revenueChartRef = viewChild<ElementRef<HTMLCanvasElement>>('revenueChart');
  donutChartRef = viewChild<ElementRef<HTMLCanvasElement>>('donutChart');

  loading = signal(true);
  stats = this.dashSvc.stats;
  recentOrders = this.dashSvc.recentOrders;
  pendingApprovals = this.dashSvc.pendingApprovals;
  topEvents = this.dashSvc.topEvents;
  topOrganizers = this.dashSvc.topOrganizers;

  private revenueChart?: Chart;
  private donutChart?: Chart;
  private baseRevenue = 124000; // store original revenue for time range calculations

  constructor() {
    effect(() => {
      const currentStats = this.stats();
      if (!currentStats) return;

      // Update donut chart
      if (this.donutChart) {
        const labels = currentStats.categoryStats.map((c) => c.category);
        const data = currentStats.categoryStats.map((c) => c.ticketsSold);
        const total = data.reduce((a, b) => a + b, 0);

        this.donutChart.data.labels = labels;
        if (total === 0) {
          this.donutChart.data.datasets[0].data = [1, 1, 1, 1, 1];
          this.donutChart.data.datasets[0].backgroundColor = ['#DADADA', '#DADADA', '#DADADA', '#DADADA', '#DADADA'];
        } else {
          this.donutChart.data.datasets[0].data = data;
          this.donutChart.data.datasets[0].backgroundColor = ['#226CEB', '#48C5E9', '#5FD788', '#FFBB23', '#FF4848', '#DADADA'];
        }
        this.donutChart.update();
      }

      // Update revenue chart
      if (this.revenueChart) {
        const rev = currentStats.revenue30d;
        const range = this.dashSvc.timeRange();

        let labels: string[];
        let dataPoints: number[];

        if (range === '1y') {
          labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dataPoints = [rev*0.08, rev*0.12, rev*0.18, rev*0.22, rev*0.30, rev*0.42, rev*0.55, rev*0.65, rev*0.74, rev*0.82, rev*0.91, rev];
        } else if (range === '90d') {
          labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12'];
          dataPoints = [rev*0.05, rev*0.12, rev*0.18, rev*0.25, rev*0.35, rev*0.42, rev*0.50, rev*0.60, rev*0.72, rev*0.80, rev*0.90, rev];
        } else {
          labels = ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'];
          dataPoints = [rev*0.10, rev*0.25, rev*0.40, rev*0.55, rev*0.70, rev*0.88, rev];
        }

        this.revenueChart.data.labels = labels;
        this.revenueChart.data.datasets[0].data = dataPoints;
        this.revenueChart.update();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.dashSvc.loadDashboard();
      // Store base revenue for time range calculations
      if (this.stats()) {
        this.baseRevenue = this.stats()!.revenue30d;
      }
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewInit(): void {
    this.initCharts();
    // Trigger the effect after charts are initialized
    setTimeout(() => {
      const s = this.stats();
      if (s) {
        this.dashSvc.stats.set({ ...s });
      }
    }, 200);
  }

  private initCharts(): void {
    const revenueEl = this.revenueChartRef()?.nativeElement;
    if (revenueEl) {
      this.revenueChart = new Chart(revenueEl, {
        type: 'line',
        data: {
          labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
          datasets: [
            {
              label: 'Revenue',
              data: [12400, 31000, 49600, 68200, 86800, 109120, 124000],
              borderColor: '#226CEB',
              backgroundColor: 'rgba(34,108,235,0.08)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#226CEB',
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1E252D',
              titleFont: { family: 'Poppins', size: 11 },
              bodyFont: { family: 'Poppins', size: 12 },
              callbacks: {
                label: (ctx) => ` $${(ctx.parsed.y ?? 0).toLocaleString()}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 } } },
            y: {
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { family: 'Poppins', size: 11 },
                callback: (v) => `$${Number(v) / 1000}k`,
              },
            },
          },
        },
      });
    }

    const donutEl = this.donutChartRef()?.nativeElement;
    if (donutEl) {
      this.donutChart = new Chart(donutEl, {
        type: 'doughnut',
        data: {
          labels: ['Concerts', 'Music Festivals', 'Sports', 'Theatre', 'Comedy', 'Others'],
          datasets: [
            {
              data: [7842, 4215, 2941, 2103, 1245, 326],
              backgroundColor: ['#226CEB', '#48C5E9', '#5FD788', '#FFBB23', '#FF4848', '#DADADA'],
              borderWidth: 0,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1E252D',
              titleFont: { family: 'Poppins', size: 11 },
              bodyFont: { family: 'Poppins', size: 12 },
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()}`,
              },
            },
          },
        },
      });
    }
  }

  formatCurrency(value: number): string {
    return '$' + value.toLocaleString();
  }

  formatDate(ts: Timestamp | Date | undefined): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : ts;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getOrderStatusClass(status: OrderDoc['status']): string {
    const map: Record<string, string> = {
      completed: 'badge-completed',
      pending: 'badge-pending',
      refunded: 'badge-refunded',
      cancelled: 'badge-cancelled',
    };
    return map[status] ?? 'badge-gray';
  }

  getOrderStatusLabel(status: OrderDoc['status']): string {
    const map: Record<string, string> = {
      completed: 'Completed',
      pending: 'Pending',
      refunded: 'Refunded',
      cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }

  onTimeRangeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const val = select.value as '30d' | '90d' | '1y';
    this.dashSvc.updateTimeRange(val);
    // The effect will automatically re-run because stats signal changed
  }

  /** Compute donut total from actual chart data */
  getDonutTotal(): string {
    const s = this.stats();
    if (!s) return '0';
    const total = s.categoryStats.reduce((sum, c) => sum + c.ticketsSold, 0);
    return total.toLocaleString();
  }
}
