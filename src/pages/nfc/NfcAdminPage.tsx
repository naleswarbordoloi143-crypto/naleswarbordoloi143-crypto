import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { NfcTag, NfcTagStatus } from '@/lib/types';
import { nfcListTags, nfcUpdateStatus } from '@/lib/nfc';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/utils';
import {
  Nfc, Shield, Search, CheckCircle, XCircle, AlertTriangle,
  User, Wheat, Tractor, Clock, Filter,
} from 'lucide-react';

const STATUS_STYLES: Record<NfcTagStatus, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-success-50', text: 'text-success-600', label: 'Active' },
  INACTIVE: { bg: 'bg-stone-100', text: 'text-stone-500', label: 'Inactive' },
  LOST: { bg: 'bg-warning-50', text: 'text-warning-600', label: 'Lost' },
  BLOCKED: { bg: 'bg-error-50', text: 'text-error-600', label: 'Blocked' },
};

const ENTITY_ICONS: Record<string, typeof Nfc> = {
  FARMER: User,
  HARVEST: Wheat,
  MACHINERY: Tractor,
};

export default function NfcAdminPage() {
  const { t } = useAuth();
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [statusModal, setStatusModal] = useState<NfcTag | null>(null);

  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    const result = await nfcListTags();
    if (result.error) {
      setError(result.error);
    } else {
      setTags(result.tags || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTags(); }, []);

  const handleUpdateStatus = async (tagUid: string, status: string) => {
    const result = await nfcUpdateStatus(tagUid, status);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatusModal(null);
    fetchTags();
  };

  const filtered = tags.filter((tag) => {
    if (filterType !== 'ALL' && tag.entity_type !== filterType) return false;
    if (filterStatus !== 'ALL' && tag.status !== filterStatus) return false;
    if (search && !tag.tag_uid.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tags.length,
    active: tags.filter((t) => t.status === 'ACTIVE').length,
    lost: tags.filter((t) => t.status === 'LOST').length,
    blocked: tags.filter((t) => t.status === 'BLOCKED').length,
    farmer: tags.filter((t) => t.entity_type === 'FARMER').length,
    harvest: tags.filter((t) => t.entity_type === 'HARVEST').length,
    machinery: tags.filter((t) => t.entity_type === 'MACHINERY').length,
  };

  if (loading) return <CardSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-stone-800 rounded-xl text-white"><Shield size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">{t('nfcAdminTitle')}</h2>
          <p className="text-sm text-stone-500">{t('nfcAdminDesc')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-pad text-center">
          <p className="text-2xl font-bold text-stone-800">{stats.total}</p>
          <p className="text-xs text-stone-400">{t('nfcTotalTags')}</p>
        </div>
        <div className="card-pad text-center">
          <p className="text-2xl font-bold text-success-600">{stats.active}</p>
          <p className="text-xs text-stone-400">{t('nfcActiveTags')}</p>
        </div>
        <div className="card-pad text-center">
          <p className="text-2xl font-bold text-warning-600">{stats.lost}</p>
          <p className="text-xs text-stone-400">{t('nfcLostTags')}</p>
        </div>
        <div className="card-pad text-center">
          <p className="text-2xl font-bold text-error-600">{stats.blocked}</p>
          <p className="text-xs text-stone-400">{t('nfcBlockedTags')}</p>
        </div>
      </div>

      {/* Entity breakdown */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-100">
          <User size={16} className="text-primary-600" />
          <span className="text-sm font-semibold text-stone-700">{stats.farmer}</span>
          <span className="text-xs text-stone-400">{t('farmer')}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-100">
          <Wheat size={16} className="text-accent-600" />
          <span className="text-sm font-semibold text-stone-700">{stats.harvest}</span>
          <span className="text-xs text-stone-400">{t('harvest')}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-100">
          <Tractor size={16} className="text-stone-600" />
          <span className="text-sm font-semibold text-stone-700">{stats.machinery}</span>
          <span className="text-xs text-stone-400">{t('machinery')}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="input-field pl-9"
            placeholder={t('nfcSearchTags')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field sm:w-40" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="ALL">{t('nfcAllTypes')}</option>
          <option value="FARMER">{t('farmer')}</option>
          <option value="HARVEST">{t('harvest')}</option>
          <option value="MACHINERY">{t('machinery')}</option>
        </select>
        <select className="input-field sm:w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="ALL">{t('nfcAllStatus')}</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOST">Lost</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      {/* Tags list */}
      {filtered.length === 0 ? (
        <div className="card-pad">
          <EmptyState icon={<Nfc size={32} />} title={t('nfcNoTags')} description={t('nfcNoTagsDesc')} />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tag) => {
            const EntityIcon = ENTITY_ICONS[tag.entity_type] || Nfc;
            const statusStyle = STATUS_STYLES[tag.status];
            return (
              <div key={tag.id} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div className="p-2 rounded-lg bg-white border border-stone-200">
                  <EntityIcon size={18} className="text-stone-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-stone-700 font-mono">{tag.tag_uid}</p>
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span>{tag.entity_type}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {tag.last_scanned_at ? formatDateTime(tag.last_scanned_at) : t('nfcNeverScanned')}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text} flex-shrink-0`}>
                  {statusStyle.label}
                </span>
                <button
                  onClick={() => setStatusModal(tag)}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 px-2 py-1 flex-shrink-0"
                >
                  {t('nfcManage')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Status management modal */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title={t('nfcManageTag')} size="sm">
        {statusModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-stone-50 p-3 text-center">
              <p className="text-xs text-stone-400 mb-1">{t('nfcTagId')}</p>
              <p className="text-lg font-bold font-mono text-stone-800">{statusModal.tag_uid}</p>
              <p className="text-xs text-stone-400 mt-1">{statusModal.entity_type}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-500 mb-2">{t('nfcSetStatus')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['ACTIVE', 'INACTIVE', 'LOST', 'BLOCKED'] as NfcTagStatus[]).map((status) => {
                  const style = STATUS_STYLES[status];
                  const isActive = statusModal.status === status;
                  return (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(statusModal.tag_uid, status)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${
                        isActive ? `${style.bg} ${style.text} border-current` : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {status === 'ACTIVE' && <CheckCircle size={14} className="inline mr-1" />}
                      {status === 'INACTIVE' && <XCircle size={14} className="inline mr-1" />}
                      {status === 'LOST' && <AlertTriangle size={14} className="inline mr-1" />}
                      {status === 'BLOCKED' && <Shield size={14} className="inline mr-1" />}
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
