'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const PARTNER_ROLES = new Set(['partner', 'sales_partner', 'vertriebspartner'])

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
    throw new Error('Keine Berechtigung für die Partnerverwaltung.')
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

export async function createPartnerAccount(formData: FormData) {
  await requireAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = String(formData.get('role') ?? 'partner').toLowerCase()

  if (!email || !fullName || !password) throw new Error('Name, E-Mail und Passwort sind Pflichtfelder.')
  if (password.length < 6) throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein.')
  if (!PARTNER_ROLES.has(role)) throw new Error('Ungültige Partnerrolle.')

  const admin = getAdminClient()
  const metadata = { full_name: fullName, company, phone, role }

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
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Der vorhandene Partnerzugang konnte nicht aktualisiert werden.')
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Der Partnerzugang konnte nicht erstellt werden.')
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
}

export async function invitePartnerAccount(formData: FormData) {
  await requireAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = String(formData.get('role') ?? 'partner').toLowerCase()

  if (!email || !fullName) throw new Error('Name und E-Mail sind Pflichtfelder.')
  if (!PARTNER_ROLES.has(role)) throw new Error('Ungültige Partnerrolle.')

  const admin = getAdminClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ema-enterprise.de'}/login`

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, company, phone, role },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Der Partnerzugang konnte nicht erstellt werden.')

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
}

export async function updatePartnerAccount(formData: FormData) {
  const { supabase } = await requireAdmin()

  const partnerId = String(formData.get('partner_id') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const company = String(formData.get('company') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const role = String(formData.get('role') ?? 'partner').toLowerCase()
  const isActive = String(formData.get('is_active') ?? 'true') === 'true'

  if (!partnerId || !fullName) throw new Error('Ungültiger Partnerdatensatz.')
  if (!PARTNER_ROLES.has(role)) throw new Error('Ungültige Partnerrolle.')

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, company: company || null, phone: phone || null, role, is_active: isActive })
    .eq('id', partnerId)

  if (error) throw new Error(error.message)
  revalidatePath('/partner-management')
}
