'use client';

import { withContinueProvider } from '../with-continue-provider';

interface InstagramItem {
  id: string;
  pageId: string;
  username: string;
  name: string;
  picture: {
    data: {
      url: string;
    };
  };
}

interface InstagramSelection {
  id: string;
  pageId: string;
}

export const InstagramContinue = withContinueProvider<
  InstagramItem,
  InstagramSelection
>({
  endpoint: 'pages',
  swrKey: 'load-instagram-pages',
  titleKey: 'select_instagram_account',
  titleDefault: 'Select Instagram Account:',
  compactEmptyState: true,
  emptyStateMessages: [
    {
      key: 'instagram_business_not_linked_title',
      text: 'Instagram Business not linked to the selected Facebook Page',
    },
    {
      key: 'instagram_business_not_linked_body',
      text: 'Social Manager publishes Instagram through Meta: the Instagram account must be Professional (Business/Creator) and linked to the Facebook Page you selected. A personal Instagram or a Page without a linked IG Business cannot complete this step.',
    },
    {
      key: 'instagram_business_not_linked_step_1',
      text: '1. In Meta Business Suite, open the pharmacy Facebook Page and confirm you are an admin.',
    },
    {
      key: 'instagram_business_not_linked_step_2',
      text: '2. Link a Professional Instagram account to that Page (Page / Instagram settings).',
    },
    {
      key: 'instagram_business_not_linked_step_3',
      text: '3. Start Connect again and select that same Page (and Business, if asked).',
    },
    {
      key: 'instagram_business_not_linked_step_4',
      text: '4. If an incomplete integration remains in Social Manager, delete it and Connect again.',
    },
    {
      key: 'instagram_business_not_linked_step_5',
      text: '5. Return to the CRM (Pharmacies → Socials) and use Resync if the list did not refresh.',
    },
    {
      key: 'instagram_business_not_linked_footnote',
      text: 'This is a Meta Page↔Instagram link issue, not a CRM login problem.',
    },
  ],
  getItemId: (item) => item.id,
  getSelectionValue: (item) => ({ id: item.id, pageId: item.pageId }),
  transformSaveData: (selection) => selection,
  isSelected: (item, selection) => selection?.id === item.id,
  renderItem: (item) => (
    <>
      <div>
        <img
          className="w-full max-w-[156px]"
          src={item.picture.data.url}
          alt="profile"
        />
      </div>
      <div>{item.name}</div>
    </>
  ),
});
