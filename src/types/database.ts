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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          barcode: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          is_visible: boolean
          min_stock: number
          name: string
          photo_urls: string[] | null
          price: number
          sku: string | null
          source: Database["public"]["Enums"]["device_source"] | null
          status: string
          stock: number
          supplier_id: string | null
          type: string
          updated_at: string
          warehouse_location: string | null
          warranty_months: number
        }
        Insert: {
          barcode?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          min_stock?: number
          name: string
          photo_urls?: string[] | null
          price?: number
          sku?: string | null
          source?: Database["public"]["Enums"]["device_source"] | null
          status?: string
          stock?: number
          supplier_id?: string | null
          type: string
          updated_at?: string
          warehouse_location?: string | null
          warranty_months?: number
        }
        Update: {
          barcode?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          min_stock?: number
          name?: string
          photo_urls?: string[] | null
          price?: number
          sku?: string | null
          source?: Database["public"]["Enums"]["device_source"] | null
          status?: string
          stock?: number
          supplier_id?: string | null
          type?: string
          updated_at?: string
          warehouse_location?: string | null
          warranty_months?: number
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
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          insights: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          insights: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          insights?: Json
          updated_at?: string
        }
        Relationships: []
      }
      cash_registers: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          ai_profile: Json | null
          created_at: string
          device_name: string | null
          discount_percent: number
          email: string | null
          id: string
          last_visit: string | null
          name: string
          notes: string | null
          notes_about_preferences: string | null
          orders_completed: number | null
          orders_total: number | null
          phone: string
          photo_urls: string[] | null
          preferred_contact: string | null
          social_links: Json | null
          source: string | null
          tags: string[] | null
          telegram_id: string | null
          total_spent: number
          total_visits: number
          updated_at: string
          vip_status: string | null
        }
        Insert: {
          ai_profile?: Json | null
          created_at?: string
          device_name?: string | null
          discount_percent?: number
          email?: string | null
          id?: string
          last_visit?: string | null
          name: string
          notes?: string | null
          notes_about_preferences?: string | null
          orders_completed?: number | null
          orders_total?: number | null
          phone: string
          photo_urls?: string[] | null
          preferred_contact?: string | null
          social_links?: Json | null
          source?: string | null
          tags?: string[] | null
          telegram_id?: string | null
          total_spent?: number
          total_visits?: number
          updated_at?: string
          vip_status?: string | null
        }
        Update: {
          ai_profile?: Json | null
          created_at?: string
          device_name?: string | null
          discount_percent?: number
          email?: string | null
          id?: string
          last_visit?: string | null
          name?: string
          notes?: string | null
          notes_about_preferences?: string | null
          orders_completed?: number | null
          orders_total?: number | null
          phone?: string
          photo_urls?: string[] | null
          preferred_contact?: string | null
          social_links?: Json | null
          source?: string | null
          tags?: string[] | null
          telegram_id?: string | null
          total_spent?: number
          total_visits?: number
          updated_at?: string
          vip_status?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          accessories_included: string | null
          battery_health: number | null
          brand: string | null
          color: string | null
          condition_description: string | null
          condition_grade:
            | Database["public"]["Enums"]["device_condition"]
            | null
          cost_price: number
          cpu: string | null
          created_at: string
          description: string | null
          gpu: string | null
          id: string
          imei: string | null
          is_visible: boolean
          model: string | null
          needs_repair: boolean
          notes: string | null
          original_box: boolean | null
          photo_urls: string[] | null
          price: number
          purchase_id: string | null
          purchased_from: string | null
          ram: string | null
          repair_cost: number
          repair_node: string | null
          repair_np_ttn: string | null
          repair_parts_replaced: Json
          repair_status: string
          screen_size: string | null
          serial_number: string | null
          sku: string | null
          source: Database["public"]["Enums"]["device_source"] | null
          source_reference: string | null
          status: string
          storage: string | null
          supplier_id: string | null
          type: string
          updated_at: string
          warehouse_location: string | null
          warranty_months: number
        }
        Insert: {
          accessories_included?: string | null
          battery_health?: number | null
          brand?: string | null
          color?: string | null
          condition_description?: string | null
          condition_grade?:
            | Database["public"]["Enums"]["device_condition"]
            | null
          cost_price?: number
          cpu?: string | null
          created_at?: string
          description?: string | null
          gpu?: string | null
          id?: string
          imei?: string | null
          is_visible?: boolean
          model?: string | null
          needs_repair?: boolean
          notes?: string | null
          original_box?: boolean | null
          photo_urls?: string[] | null
          price?: number
          purchase_id?: string | null
          purchased_from?: string | null
          ram?: string | null
          repair_cost?: number
          repair_node?: string | null
          repair_np_ttn?: string | null
          repair_parts_replaced?: Json
          repair_status?: string
          screen_size?: string | null
          serial_number?: string | null
          sku?: string | null
          source?: Database["public"]["Enums"]["device_source"] | null
          source_reference?: string | null
          status?: string
          storage?: string | null
          supplier_id?: string | null
          type: string
          updated_at?: string
          warehouse_location?: string | null
          warranty_months?: number
        }
        Update: {
          accessories_included?: string | null
          battery_health?: number | null
          brand?: string | null
          color?: string | null
          condition_description?: string | null
          condition_grade?:
            | Database["public"]["Enums"]["device_condition"]
            | null
          cost_price?: number
          cpu?: string | null
          created_at?: string
          description?: string | null
          gpu?: string | null
          id?: string
          imei?: string | null
          is_visible?: boolean
          model?: string | null
          needs_repair?: boolean
          notes?: string | null
          original_box?: boolean | null
          photo_urls?: string[] | null
          price?: number
          purchase_id?: string | null
          purchased_from?: string | null
          ram?: string | null
          repair_cost?: number
          repair_node?: string | null
          repair_np_ttn?: string | null
          repair_parts_replaced?: Json
          repair_status?: string
          screen_size?: string | null
          serial_number?: string | null
          sku?: string | null
          source?: Database["public"]["Enums"]["device_source"] | null
          source_reference?: string | null
          status?: string
          storage?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string
          warehouse_location?: string | null
          warranty_months?: number
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
          description: string | null
          id: string
          name: string
          safe_type: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          safe_type: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          safe_type?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          paid_at: string
          paid_from_safe_id: string
          receipt_url: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          paid_at?: string
          paid_from_safe_id: string
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          paid_at?: string
          paid_from_safe_id?: string
          receipt_url?: string | null
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
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_from_safe_id_fkey"
            columns: ["paid_from_safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          item_type: string
          quantity_change: number
          reason: string
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          item_type: string
          quantity_change: number
          reason: string
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          item_type?: string
          quantity_change?: number
          reason?: string
          reference_id?: string | null
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
          balance: number
          created_at: string
          discount_percent: number
          id: string
          name: string
          phone: string
          promo_code: string
          reward_percent: number
          status: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          discount_percent?: number
          id?: string
          name: string
          phone: string
          promo_code: string
          reward_percent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          discount_percent?: number
          id?: string
          name?: string
          phone?: string
          promo_code?: string
          reward_percent?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      parts: {
        Row: {
          compatible_with: string | null
          cost_price: number
          created_at: string
          debt_amount: number
          id: string
          min_stock: number
          name: string
          np_ttn: string | null
          origin_type: string | null
          paid_at: string | null
          paid_from_safe_id: string | null
          part_number: string | null
          payment_due_date: string | null
          payment_status: string
          price: number | null
          purchase_id: string | null
          status: string
          stock: number
          supplier_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          compatible_with?: string | null
          cost_price?: number
          created_at?: string
          debt_amount?: number
          id?: string
          min_stock?: number
          name: string
          np_ttn?: string | null
          origin_type?: string | null
          paid_at?: string | null
          paid_from_safe_id?: string | null
          part_number?: string | null
          payment_due_date?: string | null
          payment_status?: string
          price?: number | null
          purchase_id?: string | null
          status?: string
          stock?: number
          supplier_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          compatible_with?: string | null
          cost_price?: number
          created_at?: string
          debt_amount?: number
          id?: string
          min_stock?: number
          name?: string
          np_ttn?: string | null
          origin_type?: string | null
          paid_at?: string | null
          paid_from_safe_id?: string | null
          part_number?: string | null
          payment_due_date?: string | null
          payment_status?: string
          price?: number | null
          purchase_id?: string | null
          status?: string
          stock?: number
          supplier_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_paid_from_safe_id_fkey"
            columns: ["paid_from_safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
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
          amount: number
          cash_register_id: string
          id: string
          method: string
          monobank_payment_id: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          id?: string
          method: string
          monobank_payment_id?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          id?: string
          method?: string
          monobank_payment_id?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          item_id: string | null
          item_type: string
          purchase_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          item_type: string
          purchase_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          item_id?: string | null
          item_type?: string
          purchase_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
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
          created_at: string
          created_by: string
          expected_delivery: string | null
          id: string
          notes: string | null
          order_number: string | null
          paid_at: string | null
          paid_from_safe_id: string | null
          payment_terms: string | null
          payment_type: string
          received_at: string | null
          status: string
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          paid_at?: string | null
          paid_from_safe_id?: string | null
          payment_terms?: string | null
          payment_type?: string
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          paid_at?: string | null
          paid_from_safe_id?: string | null
          payment_terms?: string | null
          payment_type?: string
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_parts: {
        Row: {
          id: string
          part_id: string
          quantity: number
          repair_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: string
          part_id: string
          quantity?: number
          repair_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          id?: string
          part_id?: string
          quantity?: number
          repair_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_services: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          cost: number
          quantity: number
          repair_id: string
          service_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          cost?: number
          quantity?: number
          repair_id: string
          service_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          cost?: number
          quantity?: number
          repair_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_services_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_log: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          is_customer_visible: boolean | null
          notes: string | null
          repair_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          is_customer_visible?: boolean | null
          notes?: string | null
          repair_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          is_customer_visible?: boolean | null
          notes?: string | null
          repair_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_status_log_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          ai_diagnostic: Json | null
          assigned_to: string | null
          completed_at: string | null
          cost: number
          created_at: string
          customer_communication_log: Json | null
          customer_id: string | null
          device_accessories_included: string | null
          device_condition:
            | Database["public"]["Enums"]["device_condition"]
            | null
          device_condition_description: string | null
          device_condition_photos: string[] | null
          device_imei: string | null
          device_name: string
          device_password: string | null
          diagnosis_result: string | null
          estimated_completion: string | null
          external_sc_cost: number
          id: string
          inventory_device_id: string | null
          is_external_sc: boolean
          is_warranty: boolean | null
          issue: string
          issue_diagnostics: string[] | null
          issue_nodes: string[] | null
          markup_amount: number
          notes: string | null
          np_ttn: string | null
          partner_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          photo_urls: string[] | null
          price: number
          promo_code_used: string | null
          source: Database["public"]["Enums"]["repair_source"] | null
          status: string
          technician_notes_internal: string | null
          tracking_token: string | null
          public_token: string
          updated_at: string
          warranty_for_repair_id: string | null
          warranty_months: number
        }
        Insert: {
          ai_diagnostic?: Json | null
          assigned_to?: string | null
          completed_at?: string | null
          cost?: number
          created_at?: string
          customer_communication_log?: Json | null
          customer_id?: string | null
          device_accessories_included?: string | null
          device_condition?:
            | Database["public"]["Enums"]["device_condition"]
            | null
          device_condition_description?: string | null
          device_condition_photos?: string[] | null
          device_imei?: string | null
          device_name: string
          device_password?: string | null
          diagnosis_result?: string | null
          estimated_completion?: string | null
          external_sc_cost?: number
          id?: string
          inventory_device_id?: string | null
          is_external_sc?: boolean
          is_warranty?: boolean | null
          issue: string
          issue_diagnostics?: string[] | null
          issue_nodes?: string[] | null
          markup_amount?: number
          notes?: string | null
          np_ttn?: string | null
          partner_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          photo_urls?: string[] | null
          price?: number
          promo_code_used?: string | null
          source?: Database["public"]["Enums"]["repair_source"] | null
          status?: string
          technician_notes_internal?: string | null
          tracking_token?: string | null
          public_token?: string
          updated_at?: string
          warranty_for_repair_id?: string | null
          warranty_months?: number
        }
        Update: {
          ai_diagnostic?: Json | null
          assigned_to?: string | null
          completed_at?: string | null
          cost?: number
          created_at?: string
          customer_communication_log?: Json | null
          customer_id?: string | null
          device_accessories_included?: string | null
          device_condition?:
            | Database["public"]["Enums"]["device_condition"]
            | null
          device_condition_description?: string | null
          device_condition_photos?: string[] | null
          device_imei?: string | null
          device_name?: string
          device_password?: string | null
          diagnosis_result?: string | null
          estimated_completion?: string | null
          external_sc_cost?: number
          id?: string
          inventory_device_id?: string | null
          is_external_sc?: boolean
          is_warranty?: boolean | null
          issue?: string
          issue_diagnostics?: string[] | null
          issue_nodes?: string[] | null
          markup_amount?: number
          notes?: string | null
          np_ttn?: string | null
          partner_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          photo_urls?: string[] | null
          price?: number
          promo_code_used?: string | null
          source?: Database["public"]["Enums"]["repair_source"] | null
          status?: string
          technician_notes_internal?: string | null
          tracking_token?: string | null
          public_token?: string
          updated_at?: string
          warranty_for_repair_id?: string | null
          warranty_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "repairs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
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
            foreignKeyName: "repairs_warranty_for_repair_id_fkey"
            columns: ["warranty_for_repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
        ]
      }
      safes: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          item_id: string
          item_type: string
          quantity: number
          sale_id: string
          total_price: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          quantity?: number
          sale_id: string
          total_price: number
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_cost?: number | null
          unit_price?: number
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
          created_at: string
          created_by: string
          customer_id: string | null
          delivery_address: string | null
          delivery_needed: boolean | null
          delivery_tracking: string | null
          discount: number
          id: string
          is_warranty: boolean | null
          monobank_payment_id: string | null
          notes: string | null
          partner_id: string | null
          promo_code_used: string | null
          return_reason: string | null
          sale_type: Database["public"]["Enums"]["sale_type"] | null
          status: string
          total_amount: number
          warranty_end: string | null
          warranty_start: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_needed?: boolean | null
          delivery_tracking?: string | null
          discount?: number
          id?: string
          is_warranty?: boolean | null
          monobank_payment_id?: string | null
          notes?: string | null
          partner_id?: string | null
          promo_code_used?: string | null
          return_reason?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"] | null
          status?: string
          total_amount: number
          warranty_end?: string | null
          warranty_start?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivery_address?: string | null
          delivery_needed?: boolean | null
          delivery_tracking?: string | null
          discount?: number
          id?: string
          is_warranty?: boolean | null
          monobank_payment_id?: string | null
          notes?: string | null
          partner_id?: string | null
          promo_code_used?: string | null
          return_reason?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"] | null
          status?: string
          total_amount?: number
          warranty_end?: string | null
          warranty_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          category: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_visible: boolean
          name: string
          photo_urls: string[] | null
          price: number
          status: string
          updated_at: string
          warranty_days: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_visible?: boolean
          name: string
          photo_urls?: string[] | null
          price?: number
          status?: string
          updated_at?: string
          warranty_days?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_visible?: boolean
          name?: string
          photo_urls?: string[] | null
          price?: number
          status?: string
          updated_at?: string
          warranty_days?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          value?: Json
        }
        Relationships: []
      }
      store_launch_categories: {
        Row: {
          budget_limit: number
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          budget_limit?: number
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          budget_limit?: number
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_launch_expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_launch_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_launch_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_launch_milestones: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_launch_tasks: {
        Row: {
          assignee: string | null
          category_id: string | null
          created_at: string
          due_date: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          category_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          category_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_launch_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_launch_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          from_id: string | null
          from_type: string
          id: string
          reference_id: string | null
          reference_type: string | null
          to_id: string | null
          to_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_id?: string | null
          from_type: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          to_id?: string | null
          to_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_id?: string | null
          from_type?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          to_id?: string | null
          to_type?: string
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
      adjust_accessory_stock: {
        Args: { accessory_id: string; qty: number }
        Returns: number
      }
      adjust_part_stock:
        | {
            Args: {
              amount_delta: number
              p_description: string
              p_id: string
              p_user_id: string
            }
            Returns: undefined
          }
        | { Args: { part_id: string; qty: number }; Returns: number }
      create_expense: {
        Args: {
          amount: number
          category_id: string
          description: string
          paid_from_safe_id: string
          user_id: string
        }
        Returns: undefined
      }
      delete_sale: { Args: { sale_id_to_delete: string }; Returns: undefined }
      delete_transaction: {
        Args: { transaction_id_to_delete: string }
        Returns: undefined
      }
      distribute_register_funds: {
        Args: {
          amount: number
          cash_register_id: string
          desc_text: string
          growth_amount: number
          net_profit_amount: number
          opex_amount: number
          user_id: string
        }
        Returns: undefined
      }
      get_inventory_stockout_forecast: {
        Args: never
        Returns: {
          avg_daily_demand: number
          current_stock: number
          days_until_stockout: number
          item_id: string
          item_name: string
          item_type: string
          margin_percent: number
          restock_urgency: string
        }[]
      }
      get_model_demand_analytics: {
        Args: { days_back?: number }
        Returns: {
          avg_days_to_sell: number
          avg_margin: number
          brand: string
          demand_score: number
          model: string
          repair_count: number
          sold_count: number
        }[]
      }
      get_revenue_heatmap: {
        Args: { days_back?: number }
        Returns: {
          avg_check: number
          dow: number
          hour_of_day: number
          total_revenue: number
          tx_count: number
        }[]
      }
      pay_purchase_atomic: {
        Args: { p_id: string; p_safe_id: string; user_id: string }
        Returns: undefined
      }
      pay_repair: {
        Args: {
          p_amount: number
          p_cash_register_id: string
          p_repair_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      purchase_inventory_item: {
        Args: {
          amount: number
          description: string
          item_id: string
          item_type: string
          safe_id: string
          user_id: string
        }
        Returns: undefined
      }
      recalculate_customer_stats: {
        Args: { cust_id: string }
        Returns: undefined
      }
      receive_part_transit: {
        Args: { p_part_id: string; p_quantity?: number }
        Returns: undefined
      }
      receive_purchase_atomic: { Args: { p_id: string }; Returns: undefined }
      refund_repair_payment: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      refund_sale: { Args: { sale_id_to_refund: string }; Returns: undefined }
      sales_analytics: {
        Args: { p_bucket?: string; p_from?: string; p_to?: string }
        Returns: Json
      }
      search_sales_ids: {
        Args: {
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_payment?: string
          p_query?: string
        }
        Returns: {
          sale_id: string
          total_count: number
        }[]
      }
      sell_accessory: {
        Args: { accessory_id: string; qty: number }
        Returns: boolean
      }
      top_up_safe: {
        Args: {
          p_amount: number
          p_desc_text: string
          p_safe_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      transfer_funds: {
        Args: {
          amount: number
          desc_text: string
          from_id: string
          from_type: string
          to_id: string
          to_type: string
          user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      device_condition: "perfect" | "good" | "fair" | "poor" | "damaged"
      device_source:
        | "trade_in"
        | "buyout"
        | "supplier"
        | "olx"
        | "marketplace"
        | "customer_return"
        | "other"
      payment_status: "unpaid" | "paid" | "partial"
      repair_source: "walk_in" | "phone" | "online" | "marketplace"
      sale_type: "retail" | "wholesale" | "online"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      device_condition: ["perfect", "good", "fair", "poor", "damaged"],
      device_source: [
        "trade_in",
        "buyout",
        "supplier",
        "olx",
        "marketplace",
        "customer_return",
        "other",
      ],
      payment_status: ["unpaid", "paid", "partial"],
      repair_source: ["walk_in", "phone", "online", "marketplace"],
      sale_type: ["retail", "wholesale", "online"],
    },
  },
} as const
