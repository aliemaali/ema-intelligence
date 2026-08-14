import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultDocumentFolderName, NDA_DOCUMENT_FOLDER_NAME, partialInvestorAddress, type DocumentInvestor } from './documentTypes'

const investor: DocumentInvestor = {
  id: 'investor-1',
  company: 'PİXİS CAPITAL DANIŞMANLIK A.Ş.',
  contactPerson: 'Burak Özcan',
  email: 'burako@pixiscapital.com',
  phone: '',
  street: 'İstiklal Cad. Mısır Apt. No: 163 İç Kapı No: 23',
  postalCode: '34433',
  city: 'Beyoğlu / İstanbul',
  country: 'Türkiye',
}

test('document address contains the complete investor business address', () => {
  assert.equal(
    partialInvestorAddress(investor),
    'İstiklal Cad. Mısır Apt. No: 163 İç Kapı No: 23, 34433 Beyoğlu / İstanbul, Türkiye',
  )
})

test('document address omits empty address parts cleanly', () => {
  assert.equal(
    partialInvestorAddress({ ...investor, street: '', postalCode: '' }),
    'Beyoğlu / İstanbul, Türkiye',
  )
})

test('NDAs use their dedicated document folder by default', () => {
  assert.equal(defaultDocumentFolderName('nda'), NDA_DOCUMENT_FOLDER_NAME)
  assert.equal(NDA_DOCUMENT_FOLDER_NAME, 'NDA')
  assert.equal(defaultDocumentFolderName('commission'), null)
})
