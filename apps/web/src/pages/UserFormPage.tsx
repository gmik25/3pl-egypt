import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { GOVERNORATES, USER_ROLES, type GovernorateCode, type UserRole } from '@3pl/shared';
import {
  assignRole,
  createUser,
  deactivateUser,
  getUser,
  revokeRole,
  updateUser,
  type CreateUserInput,
} from '../api/users';
import { Button, Card, TextField, Alert, Spinner, Badge } from '../components/ui';
import { currentLocale } from '../i18n';

export default function UserFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const locale = currentLocale();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [scoped, setScoped] = useState<GovernorateCode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (detail.data) {
      setEmail(detail.data.email);
      setFullName(detail.data.fullName);
      setPhone(detail.data.phone ?? '');
      setRoles(detail.data.roles.map((r) => r.role.name));
      setScoped(detail.data.scopedGovernorates);
    }
  }, [detail.data]);

  const create = useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      navigate(`/users/${u.id}`, { replace: true });
    },
    onError: (e) => setError(extractError(e, t('users.saveError'))),
  });

  const update = useMutation({
    mutationFn: () => updateUser(id!, { fullName, phone: phone || undefined, password: password || undefined }),
    onSuccess: () => {
      setPassword('');
      void qc.invalidateQueries({ queryKey: ['user', id] });
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => setError(extractError(e, t('users.saveError'))),
  });

  const toggleRole = useMutation({
    mutationFn: async (role: UserRole) => {
      if (!isEdit) return;
      const existing = detail.data?.roles.find((r) => r.role.name === role);
      if (existing) await revokeRole(id!, existing.role.id);
      else await assignRole(id!, role);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['user', id] }),
  });

  const deactivate = useMutation({
    mutationFn: () => deactivateUser(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      navigate('/users', { replace: true });
    },
  });

  const onSubmitCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      email,
      fullName,
      password,
      phone: phone || undefined,
      roles,
      scopedGovernorates: scoped,
    });
  };

  if (isEdit && detail.isLoading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">{isEdit ? t('users.editTitle') : t('users.createTitle')}</h1>

      {error && <Alert>{error}</Alert>}

      {isEdit ? (
        <Card className="p-6 space-y-4">
          <TextField label={t('users.email')} value={email} disabled />
          <TextField label={t('users.name')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField label={t('users.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField
            label={t('users.resetPassword')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('users.leaveBlank')}
          />
          <div className="flex gap-2">
            <Button onClick={() => update.mutate()} disabled={update.isPending}>
              {t('common.save')}
            </Button>
            {detail.data?.isActive && (
              <Button variant="danger" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
                {t('users.deactivate')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <form onSubmit={onSubmitCreate} className="space-y-4">
            <TextField label={t('users.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label={t('users.name')} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <TextField label={t('users.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label={t('auth.password')} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <div>
              <span className="block text-sm font-medium text-ink mb-1">{t('users.roles')}</span>
              <div className="flex flex-wrap gap-2">
                {USER_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm border border-line rounded px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roles.includes(r)}
                      onChange={(e) =>
                        setRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))
                      }
                    />
                    {t(`roles.${r}`)}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('common.pleaseWait') : t('users.create')}
            </Button>
          </form>
        </Card>
      )}

      {isEdit && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('users.manageRoles')}</h2>
          <div className="flex flex-wrap gap-2">
            {USER_ROLES.map((r) => {
              const active = roles.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => toggleRole.mutate(r)}
                  disabled={toggleRole.isPending}
                  className={`px-3 py-1.5 rounded-md text-sm border transition ${
                    active
                      ? 'bg-accent/10 border-brand-300 text-accent'
                      : 'bg-surface border-line text-body hover:bg-surface-muted'
                  }`}
                >
                  {t(`roles.${r}`)}
                </button>
              );
            })}
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink mb-2">{t('users.governorateScope')}</h3>
            {scoped.length === 0 ? (
              <p className="text-sm text-faint">{t('users.noScope')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {scoped.map((g) => {
                  const gov = GOVERNORATES.find((x) => x.code === g);
                  return (
                    <Badge key={g} tone="slate">
                      {locale === 'ar' ? gov?.nameAr : gov?.nameEn}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function extractError(e: unknown, fallback: string): string {
  const ax = e as AxiosError<{ message?: string | string[] }>;
  const msg = ax.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
