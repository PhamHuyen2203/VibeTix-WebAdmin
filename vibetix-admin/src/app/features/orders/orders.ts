import { Component } from '@angular/core';

@Component({
  selector: 'app-orders',
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb"><span>Dashboard</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Orders</span></div>
      <div class="page-header"><div><h1 class="page-title">Order Management</h1><p class="page-subtitle">View and manage all ticket orders across the platform.</p></div></div>
      <div class="card" style="text-align:center;padding:60px 20px;">
        <img src="brand/mascot-vibetix.png" alt="" style="width:80px;margin:0 auto 16px;" />
        <h3>Orders module coming soon</h3>
        <p class="text-muted text-sm" style="margin-top:6px;">This feature is being built.</p>
      </div>
    </div>
  `,
  imports: [],
})
export class Orders {}
