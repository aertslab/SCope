export interface User {
  id: string;
  email: string;
  full_name: string;
  is_superuser: boolean;
  is_active?: boolean;
  has_password?: boolean;
  email_verified_at?: string | null;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  user?: User;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  visibility: 'private' | 'public' | 'password';
  created_at: string;
  datasets?: Dataset[];
  tags?: Tag[];
}

export interface ProjectShare {
  id: string;
  project_id: string;
  user_id?: string;
  group_id?: string;
  permission: 'view' | 'edit' | 'admin';
  user?: User;
  group?: Group;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  file_type: string;
  owner_id: string;
  status: string;
  failure_reason?: string | null;
  created_at: string;
  deleted_at?: string | null;
  file_size?: number;
  projects?: Project[];
}

export interface Selection {
    id: string
    name: string
    indices: number[]
    color: string
    visible: boolean
}

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  created_at: string;
  last_login?: string;
}
