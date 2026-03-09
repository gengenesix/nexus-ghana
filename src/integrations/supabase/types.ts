export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          business_id: string
          completed: boolean
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          opportunity_id: string | null
          staff_id: string | null
          subject: string
          type: string
        }
        Insert: {
          business_id: string
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          staff_id?: string | null
          subject: string
          type?: string
        }
        Update: {
          business_id?: string
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          staff_id?: string | null
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          business_id: string
          conditions: Json | null
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          name: string
          steps: Json
        }
        Insert: {
          business_id: string
          conditions?: Json | null
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          name: string
          steps?: Json
        }
        Update: {
          business_id?: string
          conditions?: Json | null
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          module: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          record_type: string
          staff_id: string | null
          staff_name: string
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_type?: string
          staff_id?: string | null
          staff_name?: string
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_type?: string
          staff_id?: string | null
          staff_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          balance: number
          bank_name: string
          business_id: string
          chart_account_id: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          balance?: number
          bank_name?: string
          business_id: string
          chart_account_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          balance?: number
          bank_name?: string
          business_id?: string
          chart_account_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          product_id: string
          quantity_to_produce: number
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          product_id: string
          quantity_to_produce?: number
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          product_id?: string
          quantity_to_produce?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_components: {
        Row: {
          bom_id: string
          id: string
          product_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          bom_id: string
          id?: string
          product_id: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          bom_id?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_components_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string
          currency: string | null
          email: string | null
          fiscal_year_start: number | null
          id: string
          industry: string | null
          logo_url: string | null
          momo_merchant_airteltigo: string | null
          momo_merchant_mtn: string | null
          momo_merchant_telecel: string | null
          name: string
          owner_id: string
          phone: string | null
          receipt_footer: string | null
          receipt_header: string | null
          receipt_show_logo: boolean
          region: string | null
          tax_getfl: boolean
          tax_nhil: boolean
          tax_vat: boolean
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          momo_merchant_airteltigo?: string | null
          momo_merchant_mtn?: string | null
          momo_merchant_telecel?: string | null
          name: string
          owner_id: string
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          receipt_show_logo?: boolean
          region?: string | null
          tax_getfl?: boolean
          tax_nhil?: boolean
          tax_vat?: boolean
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          momo_merchant_airteltigo?: string | null
          momo_merchant_mtn?: string | null
          momo_merchant_telecel?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          receipt_show_logo?: boolean
          region?: string | null
          tax_getfl?: boolean
          tax_nhil?: boolean
          tax_vat?: boolean
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_type: string
          balance: number
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
        }
        Insert: {
          account_code: string
          account_type: string
          balance?: number
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
        }
        Update: {
          account_code?: string
          account_type?: string
          balance?: number
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          business_id: string
          created_at: string
          credit_number: string
          customer_id: string | null
          customer_name: string
          date: string
          id: string
          invoice_id: string | null
          notes: string | null
          reason: string | null
          staff_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          credit_number: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          credit_number?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          id: string
          loyalty_points: number
          name: string
          notes: string | null
          phone: string | null
          region: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number
          name: string
          notes?: string | null
          phone?: string | null
          region?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number
          name?: string
          notes?: string | null
          phone?: string | null
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          business_id: string
          carrier: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          date: string
          delivery_number: string
          id: string
          notes: string | null
          sales_order_id: string | null
          shipping_address: string | null
          staff_id: string | null
          status: string
          tracking_number: string | null
        }
        Insert: {
          business_id: string
          carrier?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          delivery_number: string
          id?: string
          notes?: string | null
          sales_order_id?: string | null
          shipping_address?: string | null
          staff_id?: string | null
          status?: string
          tracking_number?: string | null
        }
        Update: {
          business_id?: string
          carrier?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          delivery_number?: string
          id?: string
          notes?: string | null
          sales_order_id?: string | null
          shipping_address?: string | null
          staff_id?: string | null
          status?: string
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account: string | null
          business_id: string
          created_at: string
          date_of_birth: string | null
          department: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          position: string | null
          salary: number | null
          salary_frequency: string | null
          staff_id: string | null
          status: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          business_id: string
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          last_name?: string
          position?: string | null
          salary?: number | null
          salary_frequency?: string | null
          staff_id?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          business_id?: string
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          position?: string | null
          salary?: number | null
          salary_frequency?: string | null
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          paid_by: string | null
          receipt_url: string | null
        }
        Insert: {
          amount?: number
          business_id: string
          category: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          paid_by?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          paid_by?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          product_id: string | null
          qty: number
          unit_price: number
        }
        Insert: {
          description?: string
          id?: string
          invoice_id: string
          product_id?: string | null
          qty?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          product_id?: string | null
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          apply_getfl: boolean
          apply_nhil: boolean
          apply_vat: boolean
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          date: string
          due_date: string
          getfl_amount: number
          id: string
          invoice_number: string
          nhil_amount: number
          notes: string | null
          status: string
          subtotal: number
          total: number
          vat_amount: number
        }
        Insert: {
          apply_getfl?: boolean
          apply_nhil?: boolean
          apply_vat?: boolean
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          due_date?: string
          getfl_amount?: number
          id?: string
          invoice_number: string
          nhil_amount?: number
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_amount?: number
        }
        Update: {
          apply_getfl?: boolean
          apply_nhil?: boolean
          apply_vat?: boolean
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          due_date?: string
          getfl_amount?: number
          id?: string
          invoice_number?: string
          nhil_amount?: number
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          business_id: string
          created_at: string
          date: string
          description: string | null
          entry_number: string
          id: string
          reference: string | null
          staff_id: string | null
          status: string
          total_credit: number
          total_debit: number
        }
        Insert: {
          business_id: string
          created_at?: string
          date?: string
          description?: string | null
          entry_number: string
          id?: string
          reference?: string | null
          staff_id?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          date?: string
          description?: string | null
          entry_number?: string
          id?: string
          reference?: string | null
          staff_id?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          cost_center: string | null
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          cost_center?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          cost_center?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          business_id: string
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          business_id: string
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          business_id: string
          created_at?: string
          days?: number
          employee_id: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          business_id?: string
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          module: string | null
          staff_id: string | null
          title: string
          type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          module?: string | null
          staff_id?: string | null
          title: string
          type?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          module?: string | null
          staff_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      number_series: {
        Row: {
          business_id: string
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          next_number: number
          pad_length: number
          prefix: string
          suffix: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          next_number?: number
          pad_length?: number
          prefix?: string
          suffix?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          next_number?: number
          pad_length?: number
          prefix?: string
          suffix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "number_series_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          expected_close: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          probability: number | null
          stage: string
          status: string
          updated_at: string
          value: number | null
          won_reason: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          expected_close?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          probability?: number | null
          stage?: string
          status?: string
          updated_at?: string
          value?: number | null
          won_reason?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          expected_close?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          probability?: number | null
          stage?: string
          status?: string
          updated_at?: string
          value?: number | null
          won_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          business_id: string
          created_at: string
          currency: string
          customer_id: string | null
          date: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_method: string
          payment_number: string
          reference: string | null
          staff_id: string | null
          status: string
          supplier_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          business_id: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: string
          payment_number: string
          reference?: string | null
          staff_id?: string | null
          status?: string
          supplier_id?: string | null
          type?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: string
          payment_number?: string
          reference?: string | null
          staff_id?: string | null
          status?: string
          supplier_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          bom_id: string | null
          business_id: string
          completion_date: string | null
          created_at: string
          id: string
          notes: string | null
          order_number: string
          planned_date: string | null
          product_id: string | null
          quantity: number
          staff_id: string | null
          status: string
        }
        Insert: {
          bom_id?: string | null
          business_id: string
          completion_date?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number: string
          planned_date?: string | null
          product_id?: string | null
          quantity?: number
          staff_id?: string | null
          status?: string
        }
        Update: {
          bom_id?: string | null
          business_id?: string
          completion_date?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          planned_date?: string | null
          product_id?: string | null
          quantity?: number
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          category_id: string | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          name: string
          qty: number
          reorder_level: number
          selling_price: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          qty?: number
          reorder_level?: number
          selling_price?: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          qty?: number
          reorder_level?: number
          selling_price?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          hours_actual: number | null
          hours_estimated: number | null
          id: string
          priority: string | null
          project_id: string
          start_date: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          hours_actual?: number | null
          hours_estimated?: number | null
          id?: string
          priority?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          hours_actual?: number | null
          hours_estimated?: number | null
          id?: string
          priority?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost: number | null
          budget: number | null
          business_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          manager_id: string | null
          name: string
          priority: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          actual_cost?: number | null
          budget?: number | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name: string
          priority?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          actual_cost?: number | null
          budget?: number | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          priority?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          business_id: string
          created_at: string
          date: string
          expected_date: string | null
          id: string
          notes: string | null
          po_number: string
          staff_id: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name: string
          tax_amount: number
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          date?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number: string
          staff_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          date?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          staff_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          license_tier: Database["public"]["Enums"]["license_tier"]
          name: string
          permissions: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          license_tier?: Database["public"]["Enums"]["license_tier"]
          name: string
          permissions?: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          license_tier?: Database["public"]["Enums"]["license_tier"]
          name?: string
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "role_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          product_name: string
          qty: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          product_name: string
          qty?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          discount_amount: number
          discount_percent: number
          id: string
          payment_method: string
          receipt_number: string | null
          staff_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          payment_method?: string
          receipt_number?: string | null
          staff_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          payment_method?: string
          receipt_number?: string | null
          staff_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          date: string
          delivery_date: string | null
          discount_amount: number
          id: string
          notes: string | null
          order_number: string
          quotation_id: string | null
          staff_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          delivery_date?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_number: string
          quotation_id?: string | null
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          delivery_date?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_number?: string
          quotation_id?: string | null
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotations: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          date: string
          id: string
          notes: string | null
          opportunity_id: string | null
          quotation_number: string
          staff_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          valid_until: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          quotation_number: string
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          valid_until?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          date?: string
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          quotation_number?: string
          staff_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_calls: {
        Row: {
          assigned_to: string | null
          business_id: string
          call_number: string
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          description: string | null
          id: string
          opened_at: string
          priority: string
          resolution: string | null
          status: string
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          call_number: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          id?: string
          opened_at?: string
          priority?: string
          resolution?: string | null
          status?: string
          subject: string
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          call_number?: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          id?: string
          opened_at?: string
          priority?: string
          resolution?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_calls_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          staff_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_group_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          business_id: string
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_online: boolean
          last_login: string | null
          license_tier: Database["public"]["Enums"]["license_tier"] | null
          name: string
          permissions: Json | null
          phone: string | null
          pin: string | null
          role: string
          role_template_id: string | null
          staff_id: string | null
          status: string
          user_type: Database["public"]["Enums"]["user_type"] | null
        }
        Insert: {
          business_id: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_online?: boolean
          last_login?: string | null
          license_tier?: Database["public"]["Enums"]["license_tier"] | null
          name: string
          permissions?: Json | null
          phone?: string | null
          pin?: string | null
          role?: string
          role_template_id?: string | null
          staff_id?: string | null
          status?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Update: {
          business_id?: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_online?: boolean
          last_login?: string | null
          license_tier?: Database["public"]["Enums"]["license_tier"] | null
          name?: string
          permissions?: Json | null
          phone?: string | null
          pin?: string | null
          role?: string
          role_template_id?: string | null
          staff_id?: string | null
          status?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_role_template_id_fkey"
            columns: ["role_template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          business_id: string
          created_at: string
          date: string
          from_warehouse_id: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          staff_id: string | null
          status: string
          to_warehouse_id: string | null
          transfer_number: string
        }
        Insert: {
          business_id: string
          created_at?: string
          date?: string
          from_warehouse_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          staff_id?: string | null
          status?: string
          to_warehouse_id?: string | null
          transfer_number: string
        }
        Update: {
          business_id?: string
          created_at?: string
          date?: string
          from_warehouse_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          staff_id?: string | null
          status?: string
          to_warehouse_id?: string | null
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          business_id: string
          contact_person: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          phone: string | null
          products_supplied: string | null
        }
        Insert: {
          business_id: string
          contact_person?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          products_supplied?: string | null
        }
        Update: {
          business_id?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          products_supplied?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          group_type: string
          id: string
          name: string
          permissions: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          name: string
          permissions?: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          name?: string
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          business_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        Insert: {
          address?: string | null
          business_id: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
        }
        Update: {
          address?: string | null
          business_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      get_business_id: { Args: never; Returns: string }
      staff_logout: { Args: { _staff_id: string }; Returns: undefined }
      verify_staff_pin: {
        Args: { _business_id: string; _pin: string }
        Returns: {
          id: string
          name: string
          role: string
          status: string
        }[]
      }
    }
    Enums: {
      license_tier:
        | "professional"
        | "limited_financial"
        | "limited_logistics"
        | "limited_sales_crm"
        | "starter"
      permission_level: "full" | "read_only" | "none"
      user_type: "superuser" | "standard" | "support_auditor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      license_tier: [
        "professional",
        "limited_financial",
        "limited_logistics",
        "limited_sales_crm",
        "starter",
      ],
      permission_level: ["full", "read_only", "none"],
      user_type: ["superuser", "standard", "support_auditor"],
    },
  },
} as const
