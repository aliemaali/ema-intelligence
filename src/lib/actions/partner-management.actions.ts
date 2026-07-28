'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MANAGED_ROLES = new Set(['admin', 'partner', 'sales_partner', 'vertriebspartner'])

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'owner'].includes(String(profile.role).toLowerCase())) {
    throw new Error('Keine Berechtigung für die Benutzerverwaltung.')
  }

  return { supabase, userId: user.id }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ist in Vercel noch nicht hinterlegt.')
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeManagedRole(value: FormDataEntryValue | null) {
  const role = String(value ?? 'partner').toLowerCase()
  if (!MANAGED_ROLES.has(role)) throw new Error('Ungültige Benutzerrolle.')
  return role === 'vertriebspartner' ? 'sales_partner' : role
}

export async function createPartnerAccount(formData: FormData) {
  await requireAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = normalizeManagedRole(formData.get('role'))

  if (!email || !fullName || !password) throw new Error('Name, E-Mail und Passwort sind Pflichtfelder.')
  if (password.length < 6) throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein.')

  const admin = getAdminClient()
  const metadata = { full_name: fullName, company, phone, role }
  const appMetadata = { role }

  const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw new Error(listError.message)

  const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === email)
  let userId: string
  let createdNewUser = false

  if (existingUser) {
    const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { ...(existingUser.app_metadata ?? {}), ...appMetadata },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Der vorhandene Benutzerzugang konnte nicht aktualisiert werden.')
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: appMetadata,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Der Benutzerzugang konnte nicht erstellt werden.')
    userId = data.user.id
    createdNewUser = true
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    company: company || null,
    phone: phone || null,
    role,
    is_active: true,
  })

  if (profileError) {
    if (createdNewUser) await admin.auth.admin.deleteUser(userId)
    throw new Error(profileError.message)
  }

  revalidatePath('/partner-management')
  redirect('/partner-management?saved=1')
}

export async function invitePartnerAccount(formData: FormData) {
  await requireAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = normalizeManagedRole(formData.get('role'))

  if (!email || !fullName) throw new Error('Name und E-Mail sind Pflichtfelder.')

  const admin = getAdminClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ema-enterprise.de'}/login`

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, company, phone, role },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Der Benutzerzugang konnte nicht erstellt werden.')

  await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { ...(data.user.app_metadata ?? {}), role },
  })

  const { error: profileError } = await admin.from('profiles').upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    company: company || null,
    phone: phone || null,
    role,
    is_active: true,
  })

  if (profileError) throw new Error(profileError.message)
  revalidatePath('/partner-management')
  redirect('/partner-management?saved=1')
}

export async function updatePartnerAccount(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const accountId = String(formData.get('partner_id') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = normalizeManagedRole(formData.get('role'))
  const isActive = String(formData.get('is_active') ?? 'true') === 'true'

  if (!accountId || !fullName) throw new Error('Ungültiger Benutzerdatensatz.')
  if (accountId === userId && (!isActive || role !== 'admin')) {
    throw new Error('Du kannst deinen eigenen Admin-Zugang nicht sperren oder herabstufen.')
  }

  const admin = getAdminClient()
  const { data: authUser, error: authReadError } = await admin.auth.admin.getUserById(accountId)
  if (authReadError) throw new Error(authReadError.message)

  const { error: authError } = await admin.auth.admin.updateUserById(accountId, {
    user_metadata: {
      ...(authUser.user?.user_metadata ?? {}),
      full_name: fullName,
      company,
      phone,
      role,
    },
    app_metadata: {
      ...(authUser.user?.app_metadata ?? {}),
      role,
    },
    ban_duration: isActive ? 'none' : '876000h',
  })
  if (authError) throw new Error(authError.message)

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, company: company || null, phone: phone || null, role, is_active: isActive })
    .eq('id', accountId)

  if (error) throw new Error(error.message)
  revalidatePath('/partner-management')
  redirect('/partner-management?saved=1')
}
