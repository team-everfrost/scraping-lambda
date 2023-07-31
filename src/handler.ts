import { Status, changeDocStatus, client } from './lib/db';

export const handler = async (event) => {
  await client.connect();

  for (const record of event.Records) {
    const messageBody = JSON.parse(record.body);
    const documentId = messageBody.documentId;

    // DB에서 Docid를 통해 가져오기
    let doc: any;

    try {
      //?
    } catch (e) {
      console.error(e);
      continue;
    }

    // 해당 Doc의 상태를 처리중으로 변경
    await changeDocStatus(documentId, Status.SCRAP_PROCESSING);

    try {
      // ?
    } catch (e) {
      console.error(e);
      await changeDocStatus(documentId, Status.SCRAP_REJECTED);
      continue;
    }

    // DB에 상태 저장
    await changeDocStatus(documentId, Status.COMPLETED);
  }

  await client.clean();
  await client.end();
  return;
};
