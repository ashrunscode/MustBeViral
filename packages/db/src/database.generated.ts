export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          last_used_at: string | null;
          name: string;
          prefix: string;
          revoked_at: string | null;
          scopes: string[];
          secret_hash: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          last_used_at?: string | null;
          name: string;
          prefix: string;
          revoked_at?: string | null;
          scopes: string[];
          secret_hash: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          prefix?: string;
          revoked_at?: string | null;
          scopes?: string[];
          secret_hash?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_keys_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      artifact_lineage: {
        Row: {
          child_artifact_id: string;
          created_at: string;
          id: string;
          parent_artifact_id: string;
          relationship: string;
          workspace_id: string;
        };
        Insert: {
          child_artifact_id: string;
          created_at?: string;
          id?: string;
          parent_artifact_id: string;
          relationship: string;
          workspace_id: string;
        };
        Update: {
          child_artifact_id?: string;
          created_at?: string;
          id?: string;
          parent_artifact_id?: string;
          relationship?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'artifact_lineage_workspace_id_child_artifact_id_fkey';
            columns: ['workspace_id', 'child_artifact_id'];
            isOneToOne: false;
            referencedRelation: 'artifacts';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'artifact_lineage_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artifact_lineage_workspace_id_parent_artifact_id_fkey';
            columns: ['workspace_id', 'parent_artifact_id'];
            isOneToOne: false;
            referencedRelation: 'artifacts';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      artifacts: {
        Row: {
          accessibility_description: string | null;
          approved_at: string | null;
          approved_by: string | null;
          artifact_kind: string;
          byte_size: number;
          canvas_revision_id: string | null;
          content_hash: string | null;
          created_at: string;
          id: string;
          mime_type: string;
          object_key: string;
          project_id: string;
          rights_attestation: Json;
          run_id: string | null;
          run_node_id: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          accessibility_description?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          artifact_kind: string;
          byte_size: number;
          canvas_revision_id?: string | null;
          content_hash?: string | null;
          created_at?: string;
          id?: string;
          mime_type: string;
          object_key: string;
          project_id: string;
          rights_attestation?: Json;
          run_id?: string | null;
          run_node_id?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          accessibility_description?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          artifact_kind?: string;
          byte_size?: number;
          canvas_revision_id?: string | null;
          content_hash?: string | null;
          created_at?: string;
          id?: string;
          mime_type?: string;
          object_key?: string;
          project_id?: string;
          rights_attestation?: Json;
          run_id?: string | null;
          run_node_id?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'artifacts_workspace_id_canvas_revision_id_fkey';
            columns: ['workspace_id', 'canvas_revision_id'];
            isOneToOne: false;
            referencedRelation: 'canvas_revisions';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'artifacts_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artifacts_workspace_id_project_id_fkey';
            columns: ['workspace_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'artifacts_workspace_id_run_id_fkey';
            columns: ['workspace_id', 'run_id'];
            isOneToOne: false;
            referencedRelation: 'runs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'artifacts_workspace_id_run_node_id_fkey';
            columns: ['workspace_id', 'run_node_id'];
            isOneToOne: false;
            referencedRelation: 'run_nodes';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      attempts: {
        Row: {
          attempt_number: number;
          created_at: string;
          id: string;
          lease_expires_at: string | null;
          lease_owner: string | null;
          provider_registration_id: string;
          request_id: string;
          run_id: string;
          run_node_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          attempt_number: number;
          created_at?: string;
          id?: string;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          provider_registration_id: string;
          request_id: string;
          run_id: string;
          run_node_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempt_number?: number;
          created_at?: string;
          id?: string;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          provider_registration_id?: string;
          request_id?: string;
          run_id?: string;
          run_node_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attempts_provider_registration_id_fkey';
            columns: ['provider_registration_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registrations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_workspace_id_run_id_fkey';
            columns: ['workspace_id', 'run_id'];
            isOneToOne: false;
            referencedRelation: 'runs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'attempts_workspace_id_run_node_id_fkey';
            columns: ['workspace_id', 'run_node_id'];
            isOneToOne: false;
            referencedRelation: 'run_nodes';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          details: Json;
          entity_id: string;
          entity_type: string;
          id: string;
          request_id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: string;
          created_at?: string;
          details?: Json;
          entity_id: string;
          entity_type: string;
          id?: string;
          request_id: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          details?: Json;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          request_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      brand_assertions: {
        Row: {
          brand_id: string;
          captured_at: string;
          created_at: string;
          created_by: string;
          draft_id: string;
          ends_at: string | null;
          excerpt: string;
          field_key: string;
          id: string;
          job_id: string | null;
          kind: string;
          locator: string;
          method: string;
          reusable: boolean;
          source_id: string;
          status: string;
          supersedes_id: string | null;
          value_text: string | null;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          captured_at: string;
          created_at?: string;
          created_by: string;
          draft_id: string;
          ends_at?: string | null;
          excerpt: string;
          field_key: string;
          id?: string;
          job_id?: string | null;
          kind: string;
          locator?: string;
          method: string;
          reusable?: boolean;
          source_id: string;
          status: string;
          supersedes_id?: string | null;
          value_text?: string | null;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          captured_at?: string;
          created_at?: string;
          created_by?: string;
          draft_id?: string;
          ends_at?: string | null;
          excerpt?: string;
          field_key?: string;
          id?: string;
          job_id?: string | null;
          kind?: string;
          locator?: string;
          method?: string;
          reusable?: boolean;
          source_id?: string;
          status?: string;
          supersedes_id?: string | null;
          value_text?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_assertions_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_assertions_workspace_id_brand_id_fkey1';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand_knowledge_drafts';
            referencedColumns: ['workspace_id', 'brand_id'];
          },
          {
            foreignKeyName: 'brand_assertions_workspace_id_job_id_fkey';
            columns: ['workspace_id', 'job_id'];
            isOneToOne: false;
            referencedRelation: 'brand_source_jobs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_assertions_workspace_id_source_id_fkey';
            columns: ['workspace_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'brand_sources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_assertions_workspace_id_supersedes_id_fkey';
            columns: ['workspace_id', 'supersedes_id'];
            isOneToOne: false;
            referencedRelation: 'brand_assertions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_kits: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          kit_data: Json;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          kit_data: Json;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          kit_data?: Json;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_kits_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      brand_knowledge_candidates: {
        Row: {
          brand_id: string;
          captured_at: string;
          created_at: string;
          created_by: string;
          draft_id: string;
          excerpt: string;
          field_key: string;
          id: string;
          job_id: string | null;
          locator: string;
          method: string;
          source_id: string;
          status: string;
          supersedes_id: string | null;
          value_text: string | null;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          captured_at: string;
          created_at?: string;
          created_by: string;
          draft_id: string;
          excerpt: string;
          field_key: string;
          id?: string;
          job_id?: string | null;
          locator?: string;
          method: string;
          source_id: string;
          status: string;
          supersedes_id?: string | null;
          value_text?: string | null;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          captured_at?: string;
          created_at?: string;
          created_by?: string;
          draft_id?: string;
          excerpt?: string;
          field_key?: string;
          id?: string;
          job_id?: string | null;
          locator?: string;
          method?: string;
          source_id?: string;
          status?: string;
          supersedes_id?: string | null;
          value_text?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_knowledge_candidates_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_knowledge_candidates_workspace_id_brand_id_fkey1';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand_knowledge_drafts';
            referencedColumns: ['workspace_id', 'brand_id'];
          },
          {
            foreignKeyName: 'brand_knowledge_candidates_workspace_id_job_id_fkey';
            columns: ['workspace_id', 'job_id'];
            isOneToOne: false;
            referencedRelation: 'brand_source_jobs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_knowledge_candidates_workspace_id_source_id_fkey';
            columns: ['workspace_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'brand_sources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_knowledge_candidates_workspace_id_supersedes_id_fkey';
            columns: ['workspace_id', 'supersedes_id'];
            isOneToOne: false;
            referencedRelation: 'brand_knowledge_candidates';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_knowledge_drafts: {
        Row: {
          brand_id: string;
          created_at: string;
          created_by: string;
          id: string;
          updated_at: string;
          updated_by: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_knowledge_drafts_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: true;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_knowledge_questions: {
        Row: {
          answer_text: string | null;
          brand_id: string;
          created_at: string;
          created_by: string;
          draft_id: string;
          excerpt: string;
          id: string;
          prompt: string;
          status: string;
          target_kind: string;
          workspace_id: string;
        };
        Insert: {
          answer_text?: string | null;
          brand_id: string;
          created_at?: string;
          created_by: string;
          draft_id: string;
          excerpt: string;
          id?: string;
          prompt: string;
          status: string;
          target_kind: string;
          workspace_id: string;
        };
        Update: {
          answer_text?: string | null;
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          draft_id?: string;
          excerpt?: string;
          id?: string;
          prompt?: string;
          status?: string;
          target_kind?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_knowledge_questions_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_knowledge_questions_workspace_id_brand_id_fkey1';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand_knowledge_drafts';
            referencedColumns: ['workspace_id', 'brand_id'];
          },
        ];
      };
      brand_locations: {
        Row: {
          brand_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          time_zone: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          time_zone: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          time_zone?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_locations_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_locations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      brand_onboarding_drafts: {
        Row: {
          audience: string;
          brand_id: string;
          created_at: string;
          created_by: string;
          current_step: string;
          description: string;
          goals: string;
          id: string;
          origin_studio_id: string;
          updated_at: string;
          updated_by: string;
          version: number;
          website_url: string;
          workspace_id: string;
        };
        Insert: {
          audience?: string;
          brand_id: string;
          created_at?: string;
          created_by: string;
          current_step?: string;
          description?: string;
          goals?: string;
          id?: string;
          origin_studio_id: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
          website_url?: string;
          workspace_id: string;
        };
        Update: {
          audience?: string;
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          current_step?: string;
          description?: string;
          goals?: string;
          id?: string;
          origin_studio_id?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
          website_url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_onboarding_drafts_origin_studio_id_fkey';
            columns: ['origin_studio_id'];
            isOneToOne: false;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brand_onboarding_drafts_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: true;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_proposals: {
        Row: {
          brand_id: string;
          confidence: string | null;
          created_at: string;
          created_by: string;
          draft_id: string;
          evidence_field_keys: Json;
          excerpt: string;
          id: string;
          kind: string;
          status: string;
          supersedes_id: string | null;
          value_text: string | null;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          confidence?: string | null;
          created_at?: string;
          created_by: string;
          draft_id: string;
          evidence_field_keys?: Json;
          excerpt: string;
          id?: string;
          kind: string;
          status: string;
          supersedes_id?: string | null;
          value_text?: string | null;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          confidence?: string | null;
          created_at?: string;
          created_by?: string;
          draft_id?: string;
          evidence_field_keys?: Json;
          excerpt?: string;
          id?: string;
          kind?: string;
          status?: string;
          supersedes_id?: string | null;
          value_text?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_proposals_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_proposals_workspace_id_brand_id_fkey1';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand_knowledge_drafts';
            referencedColumns: ['workspace_id', 'brand_id'];
          },
          {
            foreignKeyName: 'brand_proposals_workspace_id_supersedes_id_fkey';
            columns: ['workspace_id', 'supersedes_id'];
            isOneToOne: false;
            referencedRelation: 'brand_proposals';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_source_jobs: {
        Row: {
          attempt_count: number;
          brand_id: string;
          created_at: string;
          created_by: string;
          failure_code: string | null;
          filename: string;
          id: string;
          kind: string;
          lease_expires_at: string | null;
          lease_owner: string | null;
          media_type: string;
          normalized_url: string;
          request_url: string;
          source_id: string | null;
          status: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          attempt_count?: number;
          brand_id: string;
          created_at?: string;
          created_by: string;
          failure_code?: string | null;
          filename?: string;
          id?: string;
          kind: string;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          media_type?: string;
          normalized_url?: string;
          request_url?: string;
          source_id?: string | null;
          status: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          attempt_count?: number;
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          failure_code?: string | null;
          filename?: string;
          id?: string;
          kind?: string;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          media_type?: string;
          normalized_url?: string;
          request_url?: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_source_jobs_source_fk';
            columns: ['workspace_id', 'source_id'];
            isOneToOne: false;
            referencedRelation: 'brand_sources';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_source_jobs_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_sources: {
        Row: {
          brand_id: string;
          byte_size: number;
          captured_at: string;
          content_sha256: string | null;
          created_at: string;
          created_by: string;
          final_url: string;
          http_status: number | null;
          id: string;
          job_id: string | null;
          kind: string;
          media_type: string;
          method: string;
          origin_url: string;
          r2_key: string | null;
          redirect_hops: Json;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          byte_size?: number;
          captured_at: string;
          content_sha256?: string | null;
          created_at?: string;
          created_by: string;
          final_url?: string;
          http_status?: number | null;
          id?: string;
          job_id?: string | null;
          kind: string;
          media_type?: string;
          method: string;
          origin_url?: string;
          r2_key?: string | null;
          redirect_hops?: Json;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          byte_size?: number;
          captured_at?: string;
          content_sha256?: string | null;
          created_at?: string;
          created_by?: string;
          final_url?: string;
          http_status?: number | null;
          id?: string;
          job_id?: string | null;
          kind?: string;
          media_type?: string;
          method?: string;
          origin_url?: string;
          r2_key?: string | null;
          redirect_hops?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_sources_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_sources_workspace_id_job_id_fkey';
            columns: ['workspace_id', 'job_id'];
            isOneToOne: false;
            referencedRelation: 'brand_source_jobs';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_version_pins: {
        Row: {
          brand_id: string;
          brand_version_id: string;
          created_at: string;
          created_by: string;
          id: string;
          pin_key: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          brand_version_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          pin_key: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          brand_version_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          pin_key?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_version_pins_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_version_pins_workspace_id_brand_version_id_fkey';
            columns: ['workspace_id', 'brand_version_id'];
            isOneToOne: false;
            referencedRelation: 'brand_versions';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      brand_versions: {
        Row: {
          approved_at: string;
          approved_by: string;
          brand_id: string;
          created_at: string;
          draft_hash: string;
          draft_id: string;
          id: string;
          snapshot: Json;
          status: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          approved_at?: string;
          approved_by: string;
          brand_id: string;
          created_at?: string;
          draft_hash: string;
          draft_id: string;
          id?: string;
          snapshot: Json;
          status: string;
          version: number;
          workspace_id: string;
        };
        Update: {
          approved_at?: string;
          approved_by?: string;
          brand_id?: string;
          created_at?: string;
          draft_hash?: string;
          draft_id?: string;
          id?: string;
          snapshot?: Json;
          status?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_versions_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'brand_versions_workspace_id_brand_id_fkey1';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brand_knowledge_drafts';
            referencedColumns: ['workspace_id', 'brand_id'];
          },
        ];
      };
      brands: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brands_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      briefs: {
        Row: {
          brief_data: Json;
          created_at: string;
          created_by: string;
          id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          brief_data: Json;
          created_at?: string;
          created_by: string;
          id?: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          brief_data?: Json;
          created_at?: string;
          created_by?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'briefs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      canvas_revisions: {
        Row: {
          actor_id: string | null;
          actor_type: string;
          canonical_hash: string;
          canvas_id: string;
          created_at: string;
          graph_schema_version: number;
          graph_snapshot: Json;
          id: string;
          parent_revision_id: string | null;
          reason: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type: string;
          canonical_hash: string;
          canvas_id: string;
          created_at?: string;
          graph_schema_version: number;
          graph_snapshot: Json;
          id?: string;
          parent_revision_id?: string | null;
          reason: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string;
          canonical_hash?: string;
          canvas_id?: string;
          created_at?: string;
          graph_schema_version?: number;
          graph_snapshot?: Json;
          id?: string;
          parent_revision_id?: string | null;
          reason?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'canvas_revisions_workspace_id_canvas_id_fkey';
            columns: ['workspace_id', 'canvas_id'];
            isOneToOne: false;
            referencedRelation: 'canvases';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'canvas_revisions_workspace_id_canvas_id_parent_revision_id_fkey';
            columns: ['workspace_id', 'canvas_id', 'parent_revision_id'];
            isOneToOne: false;
            referencedRelation: 'canvas_revisions';
            referencedColumns: ['workspace_id', 'canvas_id', 'id'];
          },
        ];
      };
      canvases: {
        Row: {
          created_at: string;
          created_by: string;
          head_revision_id: string | null;
          id: string;
          name: string;
          project_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          head_revision_id?: string | null;
          id?: string;
          name: string;
          project_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          head_revision_id?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'canvases_head_revision_fk';
            columns: ['workspace_id', 'id', 'head_revision_id'];
            isOneToOne: false;
            referencedRelation: 'canvas_revisions';
            referencedColumns: ['workspace_id', 'canvas_id', 'id'];
          },
          {
            foreignKeyName: 'canvases_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canvases_workspace_id_project_id_fkey';
            columns: ['workspace_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      cost_reservations: {
        Row: {
          amount_micros: number;
          captured_micros: number;
          created_at: string;
          id: string;
          quote_id: string;
          refunded_micros: number;
          released_micros: number;
          run_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          amount_micros: number;
          captured_micros?: number;
          created_at?: string;
          id?: string;
          quote_id: string;
          refunded_micros?: number;
          released_micros?: number;
          run_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          amount_micros?: number;
          captured_micros?: number;
          created_at?: string;
          id?: string;
          quote_id?: string;
          refunded_micros?: number;
          released_micros?: number;
          run_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cost_reservations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cost_reservations_workspace_id_quote_id_fkey';
            columns: ['workspace_id', 'quote_id'];
            isOneToOne: true;
            referencedRelation: 'quotes';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'cost_reservations_workspace_id_run_id_fkey';
            columns: ['workspace_id', 'run_id'];
            isOneToOne: true;
            referencedRelation: 'runs';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      idempotency_records: {
        Row: {
          actor_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          operation: string;
          request_hash: string;
          response_payload: Json;
          workspace_id: string | null;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key: string;
          operation: string;
          request_hash: string;
          response_payload: Json;
          workspace_id?: string | null;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string;
          operation?: string;
          request_hash?: string;
          response_payload?: Json;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'idempotency_records_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      ledger_transactions: {
        Row: {
          account_code: string;
          amount_micros: number;
          causative_key: string;
          created_at: string;
          direction: string;
          entry_type: string;
          id: string;
          metadata: Json;
          reservation_id: string | null;
          run_id: string | null;
          transaction_id: string;
          workspace_id: string;
        };
        Insert: {
          account_code: string;
          amount_micros: number;
          causative_key: string;
          created_at?: string;
          direction: string;
          entry_type: string;
          id?: string;
          metadata?: Json;
          reservation_id?: string | null;
          run_id?: string | null;
          transaction_id: string;
          workspace_id: string;
        };
        Update: {
          account_code?: string;
          amount_micros?: number;
          causative_key?: string;
          created_at?: string;
          direction?: string;
          entry_type?: string;
          id?: string;
          metadata?: Json;
          reservation_id?: string | null;
          run_id?: string | null;
          transaction_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_transactions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_transactions_workspace_id_reservation_id_fkey';
            columns: ['workspace_id', 'reservation_id'];
            isOneToOne: false;
            referencedRelation: 'cost_reservations';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'ledger_transactions_workspace_id_run_id_fkey';
            columns: ['workspace_id', 'run_id'];
            isOneToOne: false;
            referencedRelation: 'runs';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      model_route_prices: {
        Row: {
          created_at: string;
          id: string;
          model_route_id: string;
          price_catalog_version_id: string;
          unit: string;
          unit_price_micros: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          model_route_id: string;
          price_catalog_version_id: string;
          unit: string;
          unit_price_micros: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          model_route_id?: string;
          price_catalog_version_id?: string;
          unit?: string;
          unit_price_micros?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'model_route_prices_model_route_id_fkey';
            columns: ['model_route_id'];
            isOneToOne: false;
            referencedRelation: 'model_routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'model_route_prices_price_catalog_version_id_fkey';
            columns: ['price_catalog_version_id'];
            isOneToOne: false;
            referencedRelation: 'price_catalog_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      model_routes: {
        Row: {
          capability: string;
          created_at: string;
          driver_version: string;
          id: string;
          input_schema_version: number;
          output_schema_version: number;
          provider_model_id: string;
          provider_registration_id: string;
          route_key: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          capability: string;
          created_at?: string;
          driver_version: string;
          id?: string;
          input_schema_version: number;
          output_schema_version: number;
          provider_model_id: string;
          provider_registration_id: string;
          route_key: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          capability?: string;
          created_at?: string;
          driver_version?: string;
          id?: string;
          input_schema_version?: number;
          output_schema_version?: number;
          provider_model_id?: string;
          provider_registration_id?: string;
          route_key?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'model_routes_provider_registration_id_fkey';
            columns: ['provider_registration_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registrations';
            referencedColumns: ['id'];
          },
        ];
      };
      oauth_access_tokens: {
        Row: {
          actor_id: string;
          client_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          scopes: string[];
          token_hash: string;
        };
        Insert: {
          actor_id: string;
          client_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          scopes: string[];
          token_hash: string;
        };
        Update: {
          actor_id?: string;
          client_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'oauth_access_tokens_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'oauth_clients';
            referencedColumns: ['id'];
          },
        ];
      };
      oauth_clients: {
        Row: {
          client_id: string;
          client_secret_hash: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          revoked_at: string | null;
          scopes: string[];
          workspace_id: string;
        };
        Insert: {
          client_id: string;
          client_secret_hash: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          revoked_at?: string | null;
          scopes: string[];
          workspace_id: string;
        };
        Update: {
          client_id?: string;
          client_secret_hash?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          revoked_at?: string | null;
          scopes?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'oauth_clients_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      outbox_events: {
        Row: {
          aggregate_id: string;
          aggregate_type: string;
          available_at: string;
          created_at: string;
          dedupe_key: string;
          event_type: string;
          id: string;
          lease_expires_at: string | null;
          lease_owner: string | null;
          payload: Json;
          publish_attempts: number;
          published_at: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          aggregate_id: string;
          aggregate_type: string;
          available_at?: string;
          created_at?: string;
          dedupe_key: string;
          event_type: string;
          id?: string;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          payload: Json;
          publish_attempts?: number;
          published_at?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          aggregate_id?: string;
          aggregate_type?: string;
          available_at?: string;
          created_at?: string;
          dedupe_key?: string;
          event_type?: string;
          id?: string;
          lease_expires_at?: string | null;
          lease_owner?: string | null;
          payload?: Json;
          publish_attempts?: number;
          published_at?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'outbox_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_owner_studio_mappings: {
        Row: {
          created_at: string;
          owner_id: string;
          studio_id: string;
        };
        Insert: {
          created_at?: string;
          owner_id: string;
          studio_id: string;
        };
        Update: {
          created_at?: string;
          owner_id?: string;
          studio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_owner_studio_mappings_studio_id_fkey';
            columns: ['studio_id'];
            isOneToOne: true;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_workspace_mappings: {
        Row: {
          brand_id: string;
          created_at: string;
          grant_id: string;
          owner_membership_id: string;
          studio_id: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          grant_id: string;
          owner_membership_id: string;
          studio_id: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          grant_id?: string;
          owner_membership_id?: string;
          studio_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_workspace_mappings_studio_id_fkey';
            columns: ['studio_id'];
            isOneToOne: false;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_workspace_mappings_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'platform_workspace_mappings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_workspace_mappings_workspace_id_grant_id_fkey';
            columns: ['workspace_id', 'grant_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_access_grants';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'platform_workspace_mappings_workspace_id_owner_membership__fkey';
            columns: ['workspace_id', 'owner_membership_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_memberships';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      price_catalog_versions: {
        Row: {
          created_at: string;
          currency: string;
          effective_at: string;
          id: string;
          provider_registration_id: string;
          retired_at: string | null;
          source_hash: string;
          source_ref: string;
          status: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          effective_at: string;
          id?: string;
          provider_registration_id: string;
          retired_at?: string | null;
          source_hash: string;
          source_ref: string;
          status?: string;
          version: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          effective_at?: string;
          id?: string;
          provider_registration_id?: string;
          retired_at?: string | null;
          source_hash?: string;
          source_ref?: string;
          status?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'price_catalog_versions_provider_registration_id_fkey';
            columns: ['provider_registration_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registrations';
            referencedColumns: ['id'];
          },
        ];
      };
      project_brand_mappings: {
        Row: {
          brand_id: string;
          created_at: string;
          project_id: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          project_id: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          project_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_brand_mappings_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'project_brand_mappings_workspace_id_project_id_fkey';
            columns: ['workspace_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      projects: {
        Row: {
          brand_kit_id: string | null;
          brief_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          brand_kit_id?: string | null;
          brief_id?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          brand_kit_id?: string | null;
          brief_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_workspace_id_brand_kit_id_fkey';
            columns: ['workspace_id', 'brand_kit_id'];
            isOneToOne: false;
            referencedRelation: 'brand_kits';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'projects_workspace_id_brief_id_fkey';
            columns: ['workspace_id', 'brief_id'];
            isOneToOne: false;
            referencedRelation: 'briefs';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'projects_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_jobs: {
        Row: {
          attempt_id: string;
          created_at: string;
          id: string;
          normalized_evidence: Json;
          provider_registration_id: string;
          provider_request_id: string;
          request_hash: string;
          run_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          attempt_id: string;
          created_at?: string;
          id?: string;
          normalized_evidence?: Json;
          provider_registration_id: string;
          provider_request_id: string;
          request_hash: string;
          run_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          attempt_id?: string;
          created_at?: string;
          id?: string;
          normalized_evidence?: Json;
          provider_registration_id?: string;
          provider_request_id?: string;
          request_hash?: string;
          run_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_jobs_provider_registration_id_fkey';
            columns: ['provider_registration_id'];
            isOneToOne: false;
            referencedRelation: 'provider_registrations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_jobs_workspace_id_attempt_id_fkey';
            columns: ['workspace_id', 'attempt_id'];
            isOneToOne: true;
            referencedRelation: 'attempts';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'provider_jobs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'provider_jobs_workspace_id_run_id_fkey';
            columns: ['workspace_id', 'run_id'];
            isOneToOne: false;
            referencedRelation: 'runs';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      provider_registrations: {
        Row: {
          created_at: string;
          display_name: string;
          evidence_ref: string;
          id: string;
          provider_key: string;
          reconciliation_mode: string;
          status: string;
          transport_version: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          evidence_ref: string;
          id?: string;
          provider_key: string;
          reconciliation_mode?: string;
          status?: string;
          transport_version: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          evidence_ref?: string;
          id?: string;
          provider_key?: string;
          reconciliation_mode?: string;
          status?: string;
          transport_version?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_webhook_events: {
        Row: {
          claimed_at: string;
          event_id: string;
          processed_at: string | null;
          provider: string;
          request_id: string;
          status: string;
        };
        Insert: {
          claimed_at?: string;
          event_id: string;
          processed_at?: string | null;
          provider: string;
          request_id: string;
          status?: string;
        };
        Update: {
          claimed_at?: string;
          event_id?: string;
          processed_at?: string | null;
          provider?: string;
          request_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          canvas_id: string;
          canvas_revision_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          execution_plan: Json;
          expires_at: string;
          id: string;
          maximum_charge_micros: number;
          price_catalog_version_id: string;
          project_id: string;
          quote_hash: string;
          workspace_id: string;
        };
        Insert: {
          canvas_id: string;
          canvas_revision_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          execution_plan: Json;
          expires_at: string;
          id?: string;
          maximum_charge_micros: number;
          price_catalog_version_id: string;
          project_id: string;
          quote_hash: string;
          workspace_id: string;
        };
        Update: {
          canvas_id?: string;
          canvas_revision_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          execution_plan?: Json;
          expires_at?: string;
          id?: string;
          maximum_charge_micros?: number;
          price_catalog_version_id?: string;
          project_id?: string;
          quote_hash?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quotes_price_catalog_version_id_fkey';
            columns: ['price_catalog_version_id'];
            isOneToOne: false;
            referencedRelation: 'price_catalog_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_workspace_id_canvas_id_canvas_revision_id_fkey';
            columns: ['workspace_id', 'canvas_id', 'canvas_revision_id'];
            isOneToOne: false;
            referencedRelation: 'canvas_revisions';
            referencedColumns: ['workspace_id', 'canvas_id', 'id'];
          },
          {
            foreignKeyName: 'quotes_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quotes_workspace_id_project_id_fkey';
            columns: ['workspace_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      run_nodes: {
        Row: {
          created_at: string;
          dispatch_wave: number;
          id: string;
          model_route_id: string | null;
          node_key: string;
          run_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          dispatch_wave?: number;
          id?: string;
          model_route_id?: string | null;
          node_key: string;
          run_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          dispatch_wave?: number;
          id?: string;
          model_route_id?: string | null;
          node_key?: string;
          run_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'run_nodes_model_route_id_fkey';
            columns: ['model_route_id'];
            isOneToOne: false;
            referencedRelation: 'model_routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'run_nodes_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'run_nodes_workspace_id_run_id_fkey';
            columns: ['workspace_id', 'run_id'];
            isOneToOne: false;
            referencedRelation: 'runs';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      runs: {
        Row: {
          canvas_id: string;
          canvas_revision_hash: string;
          canvas_revision_id: string;
          confirmed_at: string;
          confirmed_by: string;
          created_at: string;
          dispatch_epoch: number;
          dispatch_wave: number;
          id: string;
          project_id: string;
          quote_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          canvas_id: string;
          canvas_revision_hash: string;
          canvas_revision_id: string;
          confirmed_at?: string;
          confirmed_by: string;
          created_at?: string;
          dispatch_epoch?: number;
          dispatch_wave?: number;
          id?: string;
          project_id: string;
          quote_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          canvas_id?: string;
          canvas_revision_hash?: string;
          canvas_revision_id?: string;
          confirmed_at?: string;
          confirmed_by?: string;
          created_at?: string;
          dispatch_epoch?: number;
          dispatch_wave?: number;
          id?: string;
          project_id?: string;
          quote_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'runs_workspace_id_canvas_id_canvas_revision_id_fkey';
            columns: ['workspace_id', 'canvas_id', 'canvas_revision_id'];
            isOneToOne: false;
            referencedRelation: 'canvas_revisions';
            referencedColumns: ['workspace_id', 'canvas_id', 'id'];
          },
          {
            foreignKeyName: 'runs_workspace_id_canvas_id_canvas_revision_id_quote_id_fkey';
            columns: ['workspace_id', 'canvas_id', 'canvas_revision_id', 'quote_id'];
            isOneToOne: false;
            referencedRelation: 'quotes';
            referencedColumns: ['workspace_id', 'canvas_id', 'canvas_revision_id', 'id'];
          },
          {
            foreignKeyName: 'runs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'runs_workspace_id_project_id_fkey';
            columns: ['workspace_id', 'project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      skill_versions: {
        Row: {
          id: string;
          instructions: string;
          published_at: string;
          published_by: string;
          skill_id: string;
          title: string;
          version_number: number;
        };
        Insert: {
          id?: string;
          instructions: string;
          published_at?: string;
          published_by: string;
          skill_id: string;
          title: string;
          version_number: number;
        };
        Update: {
          id?: string;
          instructions?: string;
          published_at?: string;
          published_by?: string;
          skill_id?: string;
          title?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'skill_versions_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      skills: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'skills_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          livemode: boolean;
          payload_hash: string;
          processed_at: string | null;
          stripe_event_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          livemode?: boolean;
          payload_hash: string;
          processed_at?: string | null;
          stripe_event_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          livemode?: boolean;
          payload_hash?: string;
          processed_at?: string | null;
          stripe_event_id?: string;
        };
        Relationships: [];
      };
      studio_events: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          entity_id: string;
          id: string;
          request_id: string;
          studio_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          entity_id: string;
          id?: string;
          request_id: string;
          studio_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          entity_id?: string;
          id?: string;
          request_id?: string;
          studio_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'studio_events_studio_id_fkey';
            columns: ['studio_id'];
            isOneToOne: false;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
        ];
      };
      studio_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          accepted_membership_version: number | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          owner_membership_id: string;
          recipient_email: string;
          revoked_at: string | null;
          role: string;
          status: string;
          studio_id: string;
          version: number;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          accepted_membership_version?: number | null;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          owner_membership_id: string;
          recipient_email: string;
          revoked_at?: string | null;
          role: string;
          status?: string;
          studio_id: string;
          version?: number;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          accepted_membership_version?: number | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          owner_membership_id?: string;
          recipient_email?: string;
          revoked_at?: string | null;
          role?: string;
          status?: string;
          studio_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'studio_invitations_owner_membership_id_fkey';
            columns: ['owner_membership_id'];
            isOneToOne: false;
            referencedRelation: 'studio_memberships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'studio_invitations_studio_id_fkey';
            columns: ['studio_id'];
            isOneToOne: false;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
        ];
      };
      studio_memberships: {
        Row: {
          created_at: string;
          id: string;
          revoked_at: string | null;
          role: string;
          status: string;
          studio_id: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          revoked_at?: string | null;
          role: string;
          status?: string;
          studio_id: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          revoked_at?: string | null;
          role?: string;
          status?: string;
          studio_id?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'studio_memberships_studio_id_fkey';
            columns: ['studio_id'];
            isOneToOne: false;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
        ];
      };
      studios: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      workspace_access_grants: {
        Row: {
          actions: string[];
          brand_id: string | null;
          created_at: string;
          granted_by: string;
          id: string;
          owner_membership_id: string;
          revoked_at: string | null;
          status: string;
          studio_id: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          actions: string[];
          brand_id?: string | null;
          created_at?: string;
          granted_by: string;
          id?: string;
          owner_membership_id: string;
          revoked_at?: string | null;
          status?: string;
          studio_id: string;
          version?: number;
          workspace_id: string;
        };
        Update: {
          actions?: string[];
          brand_id?: string | null;
          created_at?: string;
          granted_by?: string;
          id?: string;
          owner_membership_id?: string;
          revoked_at?: string | null;
          status?: string;
          studio_id?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_access_grants_studio_id_fkey';
            columns: ['studio_id'];
            isOneToOne: false;
            referencedRelation: 'studios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_access_grants_workspace_id_brand_id_fkey';
            columns: ['workspace_id', 'brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['workspace_id', 'id'];
          },
          {
            foreignKeyName: 'workspace_access_grants_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_access_grants_workspace_id_owner_membership_id_fkey';
            columns: ['workspace_id', 'owner_membership_id'];
            isOneToOne: false;
            referencedRelation: 'workspace_memberships';
            referencedColumns: ['workspace_id', 'id'];
          },
        ];
      };
      workspace_billing_profiles: {
        Row: {
          setup_fee_paid_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string;
          updated_at: string;
          wallet_balance_micros: number;
          workspace_id: string;
        };
        Insert: {
          setup_fee_paid_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string;
          updated_at?: string;
          wallet_balance_micros?: number;
          workspace_id: string;
        };
        Update: {
          setup_fee_paid_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string;
          updated_at?: string;
          wallet_balance_micros?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_billing_profiles_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_memberships: {
        Row: {
          created_at: string;
          id: string;
          revoked_at: string | null;
          role: string;
          status: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          revoked_at?: string | null;
          role?: string;
          status?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          revoked_at?: string | null;
          role?: string;
          status?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_memberships_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          daily_spend_cap_micros: number;
          id: string;
          name: string;
          per_run_spend_cap_micros: number;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          daily_spend_cap_micros?: number;
          id?: string;
          name: string;
          per_run_spend_cap_micros?: number;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          daily_spend_cap_micros?: number;
          id?: string;
          name?: string;
          per_run_spend_cap_micros?: number;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      advance_copy_provider_attempt: {
        Args: {
          p_artifact_id?: string;
          p_capture_micros?: number;
          p_event_id: string;
          p_provider_request_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      advance_fal_provider_attempt: {
        Args: {
          p_artifact_id?: string;
          p_capture_micros?: number;
          p_event_id: string;
          p_provider_request_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      apply_canvas_revision: {
        Args: {
          p_canvas_id: string;
          p_expected_revision_id: string;
          p_graph_schema_version: number;
          p_graph_snapshot: Json;
          p_idempotency_key: string;
          p_reason: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      apply_stripe_subscription_update: {
        Args: {
          p_request_id: string;
          p_setup_fee_paid: boolean;
          p_stripe_customer_id: string;
          p_stripe_event_id: string;
          p_stripe_subscription_id: string;
          p_subscription_status: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      apply_stripe_wallet_credit: {
        Args: {
          p_amount_micros: number;
          p_event_type: string;
          p_metadata?: Json;
          p_request_id: string;
          p_stripe_customer_id: string;
          p_stripe_event_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      approve_run_artifacts: {
        Args: { p_approvals: Json; p_request_id: string; p_run_id: string };
        Returns: Json;
      };
      arm_stranded_dispatch: { Args: { p_limit: number }; Returns: Json };
      claim_outbox_events: {
        Args: {
          p_lease_owner: string;
          p_lease_seconds: number;
          p_limit: number;
        };
        Returns: {
          aggregate_id: string;
          aggregate_type: string;
          available_at: string;
          created_at: string;
          dedupe_key: string;
          event_type: string;
          id: string;
          lease_expires_at: string | null;
          lease_owner: string | null;
          payload: Json;
          publish_attempts: number;
          published_at: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'outbox_events';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_provider_webhook_event: {
        Args: { p_event_id: string; p_provider: string; p_request_id: string };
        Returns: Json;
      };
      create_api_key: {
        Args: {
          p_idempotency_key: string;
          p_name: string;
          p_prefix: string;
          p_request_id: string;
          p_scopes: string[];
          p_secret_hash: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_canvas_with_revision: {
        Args: {
          p_graph_schema_version: number;
          p_graph_snapshot: Json;
          p_idempotency_key: string;
          p_name: string;
          p_project_id: string;
          p_reason: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_oauth_client: {
        Args: {
          p_client_id: string;
          p_client_secret_hash: string;
          p_idempotency_key: string;
          p_name: string;
          p_request_id: string;
          p_scopes: string[];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_pending_input_artifact: {
        Args: {
          p_byte_size: number;
          p_content_hash: string;
          p_mime_type: string;
          p_project_id: string;
          p_purpose: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      create_quote: {
        Args: {
          p_canvas_id: string;
          p_expected_revision_id: string;
          p_idempotency_key: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_workspace: {
        Args: {
          p_idempotency_key: string;
          p_name: string;
          p_request_id: string;
          p_slug: string;
        };
        Returns: Json;
      };
      fail_brand_source_job: {
        Args: {
          p_expected_attempt_count: number;
          p_failure_code: string;
          p_job_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      fail_outbox_event: {
        Args: {
          p_event_id: string;
          p_max_attempts: number;
          p_retry_after_seconds: number;
        };
        Returns: Json;
      };
      finalize_cancel_requested_runs: {
        Args: { p_limit: number };
        Returns: Json;
      };
      finalize_input_artifact: {
        Args: { p_artifact_id: string; p_content_hash: string };
        Returns: Json;
      };
      find_app_idempotency: {
        Args: {
          p_idempotency_key: string;
          p_operation: string;
          p_request_hash: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      find_provider_submission_by_billing_key: {
        Args: { p_billing_idempotency_key: string };
        Returns: Json;
      };
      get_export_context: {
        Args: { p_artifact_ids: string[]; p_run_id: string };
        Returns: Json;
      };
      get_fal_artifact_context: {
        Args: { p_provider_request_id: string };
        Returns: Json;
      };
      get_global_spend_exposure: { Args: never; Returns: Json };
      get_outbox_dispatch_attempts: {
        Args: { p_event_id: string; p_lease_owner: string };
        Returns: {
          attempt_id: string;
          billing_idempotency_key: string;
          brief_context: Json;
          event_id: string;
          execution_plan_line: Json;
          node_parameters: Json;
          provider_registration_id: string;
          route_id: string;
          run_id: string;
          upstream_images: Json;
          workspace_id: string;
        }[];
      };
      get_platform_kill_switches: { Args: never; Returns: Json };
      get_provider_artifact_context: {
        Args: { p_provider_key: string; p_provider_request_id: string };
        Returns: Json;
      };
      get_run_execution_audit: { Args: { p_run_ids: string[] }; Returns: Json };
      issue_oauth_access_token: {
        Args: {
          p_client_id: string;
          p_client_secret_hash: string;
          p_expires_at: string;
          p_token_hash: string;
        };
        Returns: Json;
      };
      list_provider_jobs_for_reconciliation: {
        Args: { p_limit: number };
        Returns: {
          provider: string;
          provider_job_id: string;
          provider_request_id: string;
          route_id: string;
          status: string;
        }[];
      };
      mark_provider_webhook_event_processed: {
        Args: { p_event_id: string; p_provider: string };
        Returns: Json;
      };
      platform_billing_query: {
        Args: { p_input: Json; p_operation: string };
        Returns: Json;
      };
      platform_command: {
        Args: {
          p_idempotency_key: string;
          p_input: Json;
          p_operation: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      platform_knowledge_command: {
        Args: {
          p_idempotency_key: string;
          p_input: Json;
          p_operation: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      platform_knowledge_query: {
        Args: { p_input: Json; p_operation: string };
        Returns: Json;
      };
      platform_onboarding_command: {
        Args: {
          p_idempotency_key: string;
          p_input: Json;
          p_operation: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      platform_presentation_query: {
        Args: { p_input: Json; p_operation: string };
        Returns: Json;
      };
      platform_query: {
        Args: { p_input: Json; p_operation: string };
        Returns: Json;
      };
      platform_setup_command: {
        Args: {
          p_idempotency_key: string;
          p_input: Json;
          p_operation: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      platform_setup_query: {
        Args: { p_input: Json; p_operation: string };
        Returns: Json;
      };
      publish_outbox_event: { Args: { p_event_id: string }; Returns: Json };
      publish_skill: {
        Args: {
          p_idempotency_key: string;
          p_instructions: string;
          p_name: string;
          p_request_id: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      reap_dead_dispatch: { Args: { p_limit: number }; Returns: Json };
      reap_stranded_synchronous_jobs: {
        Args: { p_limit: number };
        Returns: Json;
      };
      record_app_idempotency: {
        Args: {
          p_idempotency_key: string;
          p_operation: string;
          p_request_hash: string;
          p_response: Json;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      record_brand_extraction: {
        Args: { p_assertions: Json; p_request_id: string; p_source_id: string };
        Returns: Json;
      };
      record_brand_source_capture: {
        Args: {
          p_expected_attempt_count: number;
          p_job_id: string;
          p_payload: Json;
          p_request_id: string;
        };
        Returns: Json;
      };
      record_ledger_movement: {
        Args: {
          p_amount_micros: number;
          p_causative_key: string;
          p_entry_type: string;
          p_metadata?: Json;
          p_request_id: string;
          p_reservation_id: string;
          p_run_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      record_provider_ambiguity: {
        Args: {
          p_attempt_id: string;
          p_billing_idempotency_key: string;
          p_event_id: string;
          p_route_id: string;
        };
        Returns: Json;
      };
      record_provider_job_error_code: {
        Args: { p_provider_error_code: string; p_provider_request_id: string };
        Returns: Json;
      };
      record_provider_job_reconciliation: {
        Args: { p_evidence: Json; p_provider_job_id: string; p_status: string };
        Returns: Json;
      };
      record_provider_submission: {
        Args: {
          p_attempt_id: string;
          p_billing_idempotency_key: string;
          p_event_id: string;
          p_provider_request_id: string;
          p_route_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      record_stripe_webhook_event:
        | {
            Args: {
              p_event_type: string;
              p_livemode: boolean;
              p_payload_hash: string;
              p_stripe_event_id: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_event_type: string;
              p_livemode: boolean;
              p_payload_hash: string;
              p_request_id: string;
              p_stripe_event_id: string;
            };
            Returns: Json;
          };
      refund_run_capture: {
        Args: {
          p_amount_micros: number;
          p_reason: string;
          p_request_id: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      register_artifact: {
        Args: {
          p_artifact_kind: string;
          p_byte_size: number;
          p_content_hash: string;
          p_mime_type: string;
          p_object_key: string;
          p_parent_artifact_ids?: string[];
          p_relationship?: string;
          p_run_id: string;
          p_run_node_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      release_provider_webhook_event: {
        Args: { p_event_id: string; p_provider: string };
        Returns: Json;
      };
      request_run_cancellation: {
        Args: { p_reason: string; p_request_id: string; p_run_id: string };
        Returns: Json;
      };
      revoke_api_key: {
        Args: { p_key_id: string; p_request_id: string };
        Returns: Json;
      };
      revoke_oauth_access_token: {
        Args: { p_request_id: string; p_token_id: string };
        Returns: Json;
      };
      revoke_oauth_client: {
        Args: { p_client_uuid: string; p_request_id: string };
        Returns: Json;
      };
      start_run_barrier: {
        Args: {
          p_canvas_id: string;
          p_confirmed: boolean;
          p_expected_revision_id: string;
          p_idempotency_key: string;
          p_quote_id: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      verify_api_key: { Args: { p_secret_hash: string }; Returns: Json };
      verify_oauth_access_token: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
