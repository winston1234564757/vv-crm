export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          id: string
          type: string
          name: string
          sku: string | null
          price: number
          cost_price: number
          stock: number
          min_stock: number
          warranty_months: number
          supplier_id: string | null
          status: string
          created_at: string
          updated_at: string
          photo_urls: string[]
          description: string | null
          is_visible: boolean
          source: string | null
          barcode: string | null
          warehouse_location: string | null
        }
        Insert: {
          id?: string
          type: string
          name: string
          sku?: string | null
          price?: number
          cost_price?: number
          stock?: number
          min_stock?: number
          warranty_months?: number
          supplier_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          photo_urls?: string[] | null
          description?: string | null
          is_visible?: boolean
          source?: string | null
          barcode?: string | null
          warehouse_location?: string | null
        }
        Update: {
          id?: string
          type?: string
          name?: string
          sku?: string | null
          price?: number
          cost_price?: number
          stock?: number
          min_stock?: number
          warranty_months?: number
          supplier_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          photo_urls?: string[] | null
          description?: string | null
          is_visible?: boolean
          source?: string | null
          barcode?: string | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accessories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_entity_insights: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          insights: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          insights: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          insights?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      cash_registers: {
        Row: {
          id: string
          name: string
          type: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string
          email: string | null
          telegram_id: string | null
          notes: string | null
          total_visits: number
          total_spent: number
          created_at: string
          updated_at: string
          discount_percent: number
          photo_urls: string[]
          tags: string[]
          source: string | null
          preferred_contact: string | null
          vip_status: string | null
          notes_about_preferences: string | null
          social_links: Json | null
          orders_total: number | null
          orders_completed: number | null
          last_visit: string | null
          ai_profile: Json | null
        }
        Insert: {
          id?: string
          name: string
          phone: string
          email?: string | null
          telegram_id?: string | null
          notes?: string | null
          total_visits?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
          discount_percent?: number
          photo_urls?: string[] | null
          tags?: string[] | null
          source?: string | null
          preferred_contact?: string | null
          vip_status?: string | null
          notes_about_preferences?: string | null
          social_links?: Json | null
          orders_total?: number | null
          orders_completed?: number | null
          last_visit?: string | null
          ai_profile?: Json | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          email?: string | null
          telegram_id?: string | null
          notes?: string | null
          total_visits?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
          discount_percent?: number
          photo_urls?: string[] | null
          tags?: string[] | null
          source?: string | null
          preferred_contact?: string | null
          vip_status?: string | null
          notes_about_preferences?: string | null
          social_links?: Json | null
          orders_total?: number | null
          orders_completed?: number | null
          last_visit?: string | null
          ai_profile?: Json | null
        }
        Relationships: [
        ]
      }
      devices: {
        Row: {
          id: string
          type: string
          brand: string | null
          model: string | null
          storage: string | null
          color: string | null
          imei: string | null
          battery_health: number | null
          sku: string | null
          price: number
          cost_price: number
          warranty_months: number
          supplier_id: string | null
          purchase_id: string | null
          status: string
          notes: string | null
          created_at: string
          updated_at: string
          ram: string | null
          screen_size: string | null
          cpu: string | null
          gpu: string | null
          needs_repair: boolean
          repair_node: string | null
          repair_cost: number
          repair_np_ttn: string | null
          photo_urls: string[]
          description: string | null
          is_visible: boolean
          source: string | null
          source_reference: string | null
          condition_grade: string | null
          condition_description: string | null
          original_box: boolean | null
          accessories_included: string | null
          serial_number: string | null
          warehouse_location: string | null
          purchased_from: string | null
          repair_status: string
          repair_parts_replaced: Json
        }
        Insert: {
          id?: string
          type: string
          brand?: string | null
          model?: string | null
          storage?: string | null
          color?: string | null
          imei?: string | null
          battery_health?: number | null
          sku?: string | null
          price?: number
          cost_price?: number
          warranty_months?: number
          supplier_id?: string | null
          purchase_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          ram?: string | null
          screen_size?: string | null
          cpu?: string | null
          gpu?: string | null
          needs_repair?: boolean
          repair_node?: string | null
          repair_cost?: number
          repair_np_ttn?: string | null
          photo_urls?: string[] | null
          description?: string | null
          is_visible?: boolean
          source?: string | null
          source_reference?: string | null
          condition_grade?: string | null
          condition_description?: string | null
          original_box?: boolean | null
          accessories_included?: string | null
          serial_number?: string | null
          warehouse_location?: string | null
          purchased_from?: string | null
          repair_status?: string
          repair_parts_replaced: Json
        }
        Update: {
          id?: string
          type?: string
          brand?: string | null
          model?: string | null
          storage?: string | null
          color?: string | null
          imei?: string | null
          battery_health?: number | null
          sku?: string | null
          price?: number
          cost_price?: number
          warranty_months?: number
          supplier_id?: string | null
          purchase_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          ram?: string | null
          screen_size?: string | null
          cpu?: string | null
          gpu?: string | null
          needs_repair?: boolean
          repair_node?: string | null
          repair_cost?: number
          repair_np_ttn?: string | null
          photo_urls?: string[] | null
          description?: string | null
          is_visible?: boolean
          source?: string | null
          source_reference?: string | null
          condition_grade?: string | null
          condition_description?: string | null
          original_box?: boolean | null
          accessories_included?: string | null
          serial_number?: string | null
          warehouse_location?: string | null
          purchased_from?: string | null
          repair_status?: string
          repair_parts_replaced?: Json
        }
        Relationships: [
          {
            foreignKeyName: "devices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          safe_type: string
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          safe_type: string
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          safe_type?: string
          description?: string | null
        }
        Relationships: [
        ]
      }
      expenses: {
        Row: {
          id: string
          category_id: string
          amount: number
          paid_from_safe_id: string
          description: string | null
          receipt_url: string | null
          paid_at: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          amount: number
          paid_from_safe_id: string
          description?: string | null
          receipt_url?: string | null
          paid_at?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          amount?: number
          paid_from_safe_id?: string
          description?: string | null
          receipt_url?: string | null
          paid_at?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_from_safe_id_fkey"
            columns: ["paid_from_safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          item_type: string
          item_id: string
          quantity_change: number
          reason: string
          reference_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_type: string
          item_id: string
          quantity_change: number
          reason: string
          reference_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_type?: string
          item_id?: string
          quantity_change?: number
          reason?: string
          reference_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          id: string
          name: string
          phone: string
          promo_code: string
          discount_percent: number
          reward_percent: number
          balance: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          promo_code: string
          discount_percent?: number
          reward_percent?: number
          balance?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          promo_code?: string
          discount_percent?: number
          reward_percent?: number
          balance?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      parts: {
        Row: {
          id: string
          name: string
          part_number: string | null
          type: string
          compatible_with: string | null
          cost_price: number
          price: number | null
          stock: number
          min_stock: number
          supplier_id: string | null
          created_at: string
          updated_at: string
          np_ttn: string | null
          origin_type: string | null
        }
        Insert: {
          id?: string
          name: string
          part_number?: string | null
          type: string
          compatible_with?: string | null
          cost_price?: number
          price?: number | null
          stock?: number
          min_stock?: number
          supplier_id?: string | null
          created_at?: string
          updated_at?: string
          np_ttn?: string | null
          origin_type?: string | null
        }
        Update: {
          id?: string
          name?: string
          part_number?: string | null
          type?: string
          compatible_with?: string | null
          cost_price?: number
          price?: number | null
          stock?: number
          min_stock?: number
          supplier_id?: string | null
          created_at?: string
          updated_at?: string
          np_ttn?: string | null
          origin_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          id: string
          sale_id: string
          amount: number
          method: string
          cash_register_id: string
          monobank_payment_id: string | null
        }
        Insert: {
          id?: string
          sale_id: string
          amount: number
          method: string
          cash_register_id: string
          monobank_payment_id?: string | null
        }
        Update: {
          id?: string
          sale_id?: string
          amount?: number
          method?: string
          cash_register_id?: string
          monobank_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
        }
        Relationships: [
        ]
      }
      purchase_items: {
        Row: {
          id: string
          purchase_id: string
          item_type: string
          item_id: string | null
          quantity: number
          unit_price: number
          total_price: number
        }
        Insert: {
          id?: string
          purchase_id: string
          item_type: string
          item_id?: string | null
          quantity?: number
          unit_price: number
          total_price: number
        }
        Update: {
          id?: string
          purchase_id?: string
          item_type?: string
          item_id?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          id: string
          supplier_id: string | null
          total_amount: number
          status: string
          paid_from_safe_id: string | null
          notes: string | null
          created_by: string
          paid_at: string | null
          received_at: string | null
          created_at: string
          updated_at: string
          order_number: string | null
          expected_delivery: string | null
          payment_terms: string | null
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          total_amount?: number
          status?: string
          paid_from_safe_id?: string | null
          notes?: string | null
          created_by: string
          paid_at?: string | null
          received_at?: string | null
          created_at?: string
          updated_at?: string
          order_number?: string | null
          expected_delivery?: string | null
          payment_terms?: string | null
        }
        Update: {
          id?: string
          supplier_id?: string | null
          total_amount?: number
          status?: string
          paid_from_safe_id?: string | null
          notes?: string | null
          created_by?: string
          paid_at?: string | null
          received_at?: string | null
          created_at?: string
          updated_at?: string
          order_number?: string | null
          expected_delivery?: string | null
          payment_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_paid_from_safe_id_fkey"
            columns: ["paid_from_safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_parts: {
        Row: {
          id: string
          repair_id: string
          part_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          repair_id: string
          part_id: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          repair_id?: string
          part_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_log: {
        Row: {
          id: string
          repair_id: string
          from_status: string | null
          to_status: string
          changed_by: string | null
          notes: string | null
          created_at: string
          is_customer_visible: boolean | null
        }
        Insert: {
          id?: string
          repair_id: string
          from_status?: string | null
          to_status: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
          is_customer_visible?: boolean | null
        }
        Update: {
          id?: string
          repair_id?: string
          from_status?: string | null
          to_status?: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
          is_customer_visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_log_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          id: string
          customer_id: string | null
          device_name: string
          device_imei: string | null
          issue: string
          status: string
          price: number
          cost: number
          warranty_months: number
          assigned_to: string | null
          tracking_token: string | null
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
          np_ttn: string | null
          is_external_sc: boolean
          external_sc_cost: number
          markup_amount: number
          photo_urls: string[]
          issue_nodes: string[]
          issue_diagnostics: string[]
          device_password: string | null
          device_accessories_included: string | null
          source: string | null
          estimated_completion: string | null
          payment_status: string | null
          diagnosis_result: string | null
          technician_notes_internal: string | null
          device_condition: string | null
          device_condition_description: string | null
          device_condition_photos: string[]
          customer_communication_log: Json | null
          partner_id: string | null
          promo_code_used: string | null
          inventory_device_id: string | null
          ai_diagnostic: Json | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          device_name: string
          device_imei?: string | null
          issue: string
          status?: string
          price?: number
          cost?: number
          warranty_months?: number
          assigned_to?: string | null
          tracking_token?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          np_ttn?: string | null
          is_external_sc?: boolean
          external_sc_cost?: number
          markup_amount?: number
          photo_urls?: string[] | null
          issue_nodes?: string[] | null
          issue_diagnostics?: string[] | null
          device_password?: string | null
          device_accessories_included?: string | null
          source?: string | null
          estimated_completion?: string | null
          payment_status?: string | null
          diagnosis_result?: string | null
          technician_notes_internal?: string | null
          device_condition?: string | null
          device_condition_description?: string | null
          device_condition_photos?: string[] | null
          customer_communication_log?: Json | null
          partner_id?: string | null
          promo_code_used?: string | null
          inventory_device_id?: string | null
          ai_diagnostic?: Json | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          device_name?: string
          device_imei?: string | null
          issue?: string
          status?: string
          price?: number
          cost?: number
          warranty_months?: number
          assigned_to?: string | null
          tracking_token?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          np_ttn?: string | null
          is_external_sc?: boolean
          external_sc_cost?: number
          markup_amount?: number
          photo_urls?: string[] | null
          issue_nodes?: string[] | null
          issue_diagnostics?: string[] | null
          device_password?: string | null
          device_accessories_included?: string | null
          source?: string | null
          estimated_completion?: string | null
          payment_status?: string | null
          diagnosis_result?: string | null
          technician_notes_internal?: string | null
          device_condition?: string | null
          device_condition_description?: string | null
          device_condition_photos?: string[] | null
          customer_communication_log?: Json | null
          partner_id?: string | null
          promo_code_used?: string | null
          inventory_device_id?: string | null
          ai_diagnostic?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      safes: {
        Row: {
          id: string
          name: string
          type: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          item_type: string
          item_id: string
          quantity: number
          unit_price: number
          total_price: number
          unit_cost: number | null
        }
        Insert: {
          id?: string
          sale_id: string
          item_type: string
          item_id: string
          quantity?: number
          unit_price: number
          total_price: number
          unit_cost?: number | null
        }
        Update: {
          id?: string
          sale_id?: string
          item_type?: string
          item_id?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          unit_cost?: number | null
        }
        Relationships: [
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
          id: string
          customer_id: string | null
          total_amount: number
          discount: number
          notes: string | null
          created_by: string
          created_at: string
          sale_type: string | null
          delivery_needed: boolean | null
          delivery_address: string | null
          delivery_tracking: string | null
          monobank_payment_id: string | null
          warranty_start: string | null
          return_reason: string | null
          partner_id: string | null
          promo_code_used: string | null
          warranty_end: string | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          total_amount: number
          discount?: number
          notes?: string | null
          created_by: string
          created_at?: string
          sale_type?: string | null
          delivery_needed?: boolean | null
          delivery_address?: string | null
          delivery_tracking?: string | null
          monobank_payment_id?: string | null
          warranty_start?: string | null
          return_reason?: string | null
          partner_id?: string | null
          promo_code_used?: string | null
          warranty_end?: string | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          total_amount?: number
          discount?: number
          notes?: string | null
          created_by?: string
          created_at?: string
          sale_type?: string | null
          delivery_needed?: boolean | null
          delivery_address?: string | null
          delivery_tracking?: string | null
          monobank_payment_id?: string | null
          warranty_start?: string | null
          return_reason?: string | null
          partner_id?: string | null
          promo_code_used?: string | null
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          category: string
          photo_urls: string[]
          is_visible: boolean
          status: string
          created_at: string
          updated_at: string
          duration_minutes: number | null
          warranty_days: number | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price?: number
          category?: string
          photo_urls?: string[] | null
          is_visible?: boolean
          status?: string
          created_at?: string
          updated_at?: string
          duration_minutes?: number | null
          warranty_days?: number | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string
          photo_urls?: string[] | null
          is_visible?: boolean
          status?: string
          created_at?: string
          updated_at?: string
          duration_minutes?: number | null
          warranty_days?: number | null
        }
        Relationships: [
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
        }
        Relationships: [
        ]
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      transactions: {
        Row: {
          id: string
          amount: number
          from_type: string
          from_id: string | null
          to_type: string
          to_id: string | null
          reference_type: string | null
          reference_id: string | null
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          amount: number
          from_type: string
          from_id?: string | null
          to_type: string
          to_id?: string | null
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          amount?: number
          from_type?: string
          from_id?: string | null
          to_type?: string
          to_id?: string | null
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      transfer_funds: {
        Args: {
          from_id: string
          from_type: string
          to_id: string
          to_type: string
          amount: number
          desc_text: string | null
          user_id: string
        }
        Returns: undefined
      }
      create_expense: {
        Args: {
          category_id: string
          amount: number
          paid_from_safe_id: string
          description: string
          user_id: string
        }
        Returns: undefined
      }
      distribute_register_funds: {
        Args: {
          cash_register_id: string
          amount: number
          opex_amount: number
          growth_amount: number
          net_profit_amount: number
          desc_text: string
          user_id: string
        }
        Returns: undefined
      }
      receive_purchase_atomic: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      pay_purchase_atomic: {
        Args: {
          p_id: string
          p_safe_id: string
          user_id: string
        }
        Returns: undefined
      }
      delete_transaction: {
        Args: {
          transaction_id_to_delete: string
        }
        Returns: undefined
      }
      delete_sale: {
        Args: {
          sale_id_to_delete: string
        }
        Returns: undefined
      }
      get_model_demand_analytics: {
        Args: {
          days_back?: number
        }
        Returns: {
          brand: string
          model: string
          repair_count: number
          sold_count: number
          avg_margin: number
          avg_days_to_sell: number
          demand_score: number
        }[]
      }
      get_inventory_stockout_forecast: {
        Args: Record<PropertyKey, never>
        Returns: {
          item_id: string
          item_name: string
          item_type: string
          current_stock: number
          avg_daily_demand: number
          days_until_stockout: number
          restock_urgency: string
          margin_percent: number
        }[]
      }
      purchase_inventory_item: {
        Args: {
          item_type: string
          item_id: string
          safe_id: string
          amount: number
          description: string
          user_id: string
        }
        Returns: undefined
      }
      get_revenue_heatmap: {
        Args: {
          days_back?: number
        }
        Returns: {
          dow: number
          hour_of_day: number
          total_revenue: number
          tx_count: number
          avg_check: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
