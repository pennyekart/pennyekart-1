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
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: string
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          item_count: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_type?: string
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          item_count?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          item_count?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_staff_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          staff_user_id: string
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          staff_user_id: string
          type?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          staff_user_id?: string
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_staff_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_staff_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "delivery_staff_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_staff_wallets: {
        Row: {
          balance: number
          created_at: string
          earning_balance: number
          id: string
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          earning_balance?: number
          id?: string
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          earning_balance?: number
          id?: string
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_staff_ward_assignments: {
        Row: {
          created_at: string
          id: string
          local_body_id: string
          staff_user_id: string
          ward_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          local_body_id: string
          staff_user_id: string
          ward_number: number
        }
        Update: {
          created_at?: string
          id?: string
          local_body_id?: string
          staff_user_id?: string
          ward_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_staff_ward_assignments_local_body_id_fkey"
            columns: ["local_body_id"]
            isOneToOne: false
            referencedRelation: "locations_local_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      godown_local_bodies: {
        Row: {
          created_at: string
          godown_id: string
          id: string
          local_body_id: string
        }
        Insert: {
          created_at?: string
          godown_id: string
          id?: string
          local_body_id: string
        }
        Update: {
          created_at?: string
          godown_id?: string
          id?: string
          local_body_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "godown_local_bodies_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_local_bodies_local_body_id_fkey"
            columns: ["local_body_id"]
            isOneToOne: false
            referencedRelation: "locations_local_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      godown_stock: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          godown_id: string
          id: string
          product_id: string
          purchase_number: string | null
          purchase_price: number
          quantity: number
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          godown_id: string
          id?: string
          product_id: string
          purchase_number?: string | null
          purchase_price?: number
          quantity?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          godown_id?: string
          id?: string
          product_id?: string
          purchase_number?: string | null
          purchase_price?: number
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "godown_stock_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      godown_wards: {
        Row: {
          created_at: string
          godown_id: string
          id: string
          local_body_id: string
          ward_number: number
        }
        Insert: {
          created_at?: string
          godown_id: string
          id?: string
          local_body_id: string
          ward_number: number
        }
        Update: {
          created_at?: string
          godown_id?: string
          id?: string
          local_body_id?: string
          ward_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "godown_wards_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "godown_wards_local_body_id_fkey"
            columns: ["local_body_id"]
            isOneToOne: false
            referencedRelation: "locations_local_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      godowns: {
        Row: {
          created_at: string
          godown_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          godown_type?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          godown_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations_districts: {
        Row: {
          country: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          state: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          state?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations_local_bodies: {
        Row: {
          body_type: string
          created_at: string
          district_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          ward_count: number
        }
        Insert: {
          body_type?: string
          created_at?: string
          district_id: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          ward_count?: number
        }
        Update: {
          body_type?: string
          created_at?: string
          district_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          ward_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "locations_local_bodies_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "locations_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_delivery_staff_id: string | null
          created_at: string
          godown_id: string | null
          id: string
          items: Json
          seller_id: string | null
          seller_product_id: string | null
          shipping_address: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_delivery_staff_id?: string | null
          created_at?: string
          godown_id?: string | null
          id?: string
          items?: Json
          seller_id?: string | null
          seller_product_id?: string | null
          shipping_address?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_delivery_staff_id?: string | null
          created_at?: string
          godown_id?: string | null
          id?: string
          items?: Json
          seller_id?: string | null
          seller_product_id?: string | null
          shipping_address?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_product_id_fkey"
            columns: ["seller_product_id"]
            isOneToOne: false
            referencedRelation: "seller_products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          feature: string
          id: string
          name: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          feature: string
          id?: string
          name: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          feature?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          coming_soon: boolean
          created_at: string
          created_by: string | null
          description: string | null
          discount_rate: number
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          is_active: boolean
          mrp: number
          name: string
          price: number
          purchase_rate: number
          section: string | null
          stock: number
          updated_at: string
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          coming_soon?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_rate?: number
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          mrp?: number
          name: string
          price?: number
          purchase_rate?: number
          section?: string | null
          stock?: number
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string | null
          coming_soon?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_rate?: number
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          mrp?: number
          name?: string
          price?: number
          purchase_rate?: number
          section?: string | null
          stock?: number
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          delivery_type: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          is_super_admin: boolean
          local_body_id: string | null
          mobile_number: string | null
          role_id: string | null
          updated_at: string
          user_id: string
          user_type: string
          ward_number: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          delivery_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_super_admin?: boolean
          local_body_id?: string | null
          mobile_number?: string | null
          role_id?: string | null
          updated_at?: string
          user_id: string
          user_type?: string
          ward_number?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          delivery_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          is_super_admin?: boolean
          local_body_id?: string | null
          mobile_number?: string | null
          role_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
          ward_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_local_body_id_fkey"
            columns: ["local_body_id"]
            isOneToOne: false
            referencedRelation: "locations_local_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_counter: {
        Row: {
          id: string
          last_number: number
          updated_at: string
        }
        Insert: {
          id?: string
          last_number?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_godown_assignments: {
        Row: {
          created_at: string
          godown_id: string
          id: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          godown_id: string
          id?: string
          seller_id: string
        }
        Update: {
          created_at?: string
          godown_id?: string
          id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_godown_assignments_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_products: {
        Row: {
          area_godown_id: string | null
          category: string | null
          created_at: string
          description: string | null
          discount_rate: number
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          is_active: boolean
          is_approved: boolean
          is_featured: boolean
          mrp: number
          name: string
          price: number
          purchase_rate: number
          seller_id: string
          stock: number
          updated_at: string
          video_url: string | null
        }
        Insert: {
          area_godown_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          discount_rate?: number
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          is_approved?: boolean
          is_featured?: boolean
          mrp?: number
          name: string
          price?: number
          purchase_rate?: number
          seller_id: string
          stock?: number
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          area_godown_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          discount_rate?: number
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          is_active?: boolean
          is_approved?: boolean
          is_featured?: boolean
          mrp?: number
          name?: string
          price?: number
          purchase_rate?: number
          seller_id?: string
          stock?: number
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_products_area_godown_id_fkey"
            columns: ["area_godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          seller_id: string
          settled_by: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          seller_id: string
          settled_by?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          seller_id?: string
          settled_by?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "seller_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          logo_url: string | null
          name: string
          price: number
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      stock_transfers: {
        Row: {
          batch_number: string | null
          created_at: string
          created_by: string | null
          from_godown_id: string
          id: string
          product_id: string
          quantity: number
          status: string
          to_godown_id: string
          transfer_type: string
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          from_godown_id: string
          id?: string
          product_id: string
          quantity: number
          status?: string
          to_godown_id: string
          transfer_type?: string
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          from_godown_id?: string
          id?: string
          product_id?: string
          quantity?: number
          status?: string
          to_godown_id?: string
          transfer_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_godown_id_fkey"
            columns: ["from_godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
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
            foreignKeyName: "stock_transfers_to_godown_id_fkey"
            columns: ["to_godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_purchase_number: { Args: never; Returns: number }
      get_orders_for_seller: {
        Args: { seller_user_id: string }
        Returns: {
          assigned_delivery_staff_id: string | null
          created_at: string
          godown_id: string | null
          id: string
          items: Json
          seller_id: string | null
          seller_product_id: string | null
          shipping_address: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_permission: { Args: { _permission_name: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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
